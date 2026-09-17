import { encryptCredentials, encrypt } from "../../../utils/crypto";
import { In, Repository } from "typeorm";
import AppDataSource from "../../../db/data-source";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";
import { TradeSignal } from "../../../entity/TradeSignals";
import { TradeSignalStatus } from "../../../entity/TradeSignalsStatus";
import { TradingAccountStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";

export class CoinDCXDB {
	private accountRepo: Repository<UserTradingAccount>;
	private tradeSignalRepo: Repository<TradeSignal>;
	private tradeSignalStatusRepo: Repository<TradeSignalStatus>;

	constructor() {
		this.accountRepo = AppDataSource.getRepository(UserTradingAccount);
		this.tradeSignalRepo = AppDataSource.getRepository(TradeSignal);
		this.tradeSignalStatusRepo = AppDataSource.getRepository(TradeSignalStatus);
	}

	async getTradingAccountById(userId: number, id: number) {
		return this.accountRepo.findOne({
			where: [
				{ id, userId, broker: { code: "COINDCX" } },
				{ id, userId, broker: { name: "CoinDCX" } },
			],
			relations: ["broker"],
		});
	}

	async getTradingAccountProfile(userId: number, tradingAccountId: number) {
		const rows = await this.accountRepo.query(
			`
			SELECT 
				ta.id,
				ta.user_id,
				u.name AS user_name,
				u.email AS user_email,
				ta.account_id,
				ta.account_label,
				ta.status,
				ta.is_enabled,
				ta.is_master,
				ta.execution_flow,
				ta.last_verified_at,
				ta.created_at,
				ta.updated_at,
				ta.account_meta,
				b.code AS broker_code,
				b.name AS broker_name,
				b.market_category
			FROM user_trading_accounts ta
			JOIN users u ON u.id = ta.user_id
			JOIN brokers b ON b.id = ta.broker_id
			WHERE ta.id = $1
			  AND ta.user_id = $2
			  AND (UPPER(b.code) = 'COINDCX' OR UPPER(b.name) = 'COINDCX')
			LIMIT 1
			`,
			[tradingAccountId, userId]
		);

		return rows?.[0] ?? null;
	}

	async updateAccountMeta(
		account: UserTradingAccount,
		metaPatch: Record<string, any>,
		verification?: { status: TradingAccountStatus; checkedAt: Date | null }
	) {
		const nextMeta = {
			...(account.accountMeta ?? {}),
			...metaPatch,
		};

		account.accountMeta = encryptCredentials(nextMeta);
        if (account.accessToken) account.accessToken = encrypt(account.accessToken);
        if (account.refreshToken) account.refreshToken = encrypt(account.refreshToken);
		if (verification) {
			account.status = verification.status;
			account.lastVerifiedAt = verification.checkedAt;
		}

		return this.accountRepo.save(account);
	}

	async clearAuthMeta(account: UserTradingAccount) {
		const meta = { ...(account.accountMeta ?? {}) };

		delete meta.coindcx;
		delete meta.coinDCX;
		delete meta.coinDcx;
		delete meta.apiKey;
		delete meta.apiSecret;
		delete meta.coindcxApiKey;
		delete meta.coindcxApiSecret;
		delete meta.baseUrl;
		delete meta.coindcxBaseUrl;

		account.accountMeta = meta;
		account.status = TradingAccountStatus.PENDING;
		account.lastVerifiedAt = null;

		return this.accountRepo.save(account);
	}

	async markJobInProgress(job: TradeSignal) {
		if (!job?.status?.id) return;

		await this.tradeSignalRepo.manager.query(
			`
			UPDATE trade_signals_status
			SET status = 'in_progress',
				updated_at = NOW()
			WHERE id = $1
			`,
			[job.status.id]
		);
	}

	async markJobSuccess(job: TradeSignal, brokerOrderId?: string | null) {
        if (!job?.status?.id) throw new Error("trade_signal_status_missing");
        const closing = job.status.status === "in_progress_close";
        await AppDataSource.transaction(async manager => {
            if (brokerOrderId && closing) await manager.query(`UPDATE trade_signals SET broker_close_order_id=$2,updated_at=NOW() WHERE id=$1`, [job.id, String(brokerOrderId)]);
            if (brokerOrderId && !closing) await manager.query(
                `UPDATE trade_signals SET broker_order_id=$2, updated_at=NOW() WHERE id=$1`, [job.id, String(brokerOrderId)]);
            await manager.query(`UPDATE trade_signals_status SET status=$2, last_error=NULL, updated_at=NOW() WHERE id=$1`, [job.status.id, closing ? "in_progress_close" : "submitted"]);
        });
    }

    async markJobFailed(job: TradeSignal, error: string | Error) {
        if (!job?.status?.id) throw new Error("trade_signal_status_missing");
        const detail = error instanceof Error ? error.stack ?? error.message : String(error);
        await this.tradeSignalRepo.manager.query(
            `UPDATE trade_signals_status SET status='failed', attempts=COALESCE(attempts,0)+1, last_error=$2, next_retry_at=NULL, updated_at=NOW() WHERE id=$1`,
            [job.status.id, detail]);
    }

	async claimPendingTrades(limit: number) {
		const qr = AppDataSource.createQueryRunner();

		await qr.connect();
		await qr.startTransaction();

		try {
			const statusRepo = qr.manager.getRepository(TradeSignalStatus);

			const qb: any = statusRepo
				.createQueryBuilder("s")
				.select("s.tradeSignalId", "id")
                .addSelect("s.status", "status")
				.innerJoin("s.tradeSignal", "ts")
				.innerJoin("ts.tradingAccount", "ta")
				.innerJoin("ta.broker", "b")
				.where("s.status IN (:...statuses)", { statuses: ["pending", "pending_close"] })
				.andWhere("(b.code = :code OR b.name = :name)", {
					code: "COINDCX",
					name: "CoinDCX",
				})
				.orderBy("s.tradeSignalId", "ASC")
				.limit(limit)
				.setLock("pessimistic_write");

			if (typeof qb.setOnLocked === "function") {
				qb.setOnLocked("skip_locked");
			}

			const rows: Array<{ id: any; status: string }> = await qb.getRawMany();
			const ids = rows.map((r) => Number(r.id)).filter(Boolean);

			if (!ids.length) {
				await qr.commitTransaction();
				return [] as TradeSignal[];
			}

			await statusRepo
				.createQueryBuilder()
				.update(TradeSignalStatus)
				.set({
					status: () => "CASE WHEN status = 'pending_close' THEN 'in_progress_close' ELSE 'in_progress' END",
					updatedAt: new Date(),
				})
				.where("tradeSignalId IN (:...ids)", { ids })
				.execute();

			const signals = await qr.manager
				.getRepository(TradeSignal)
				.createQueryBuilder("ts")
				.leftJoinAndSelect("ts.tradingAccount", "ta")
				.leftJoinAndSelect("ta.broker", "b")
				.leftJoinAndSelect("ts.status", "tss")
                .leftJoinAndSelect("ts.strategy", "strategy")
				.where("ts.id IN (:...ids)", { ids })
				.andWhere("(b.code = :code OR b.name = :name)", {
					code: "COINDCX",
					name: "CoinDCX",
				})
				.orderBy("ts.id", "ASC")
				.getMany();

			await qr.commitTransaction();

			return signals;
		} catch (e) {
			await qr.rollbackTransaction();
			throw e;
		} finally {
			await qr.release();
		}
	}

	async updateTradeStatus(
		data: {
			id: number;
			status: string;
			error?: string;
			brokerOrderId?: string | null;
		}[]
	) {
		const ids = data.map((d) => d.id).filter(Boolean);

		if (!ids.length) return;

		const jobs = await this.tradeSignalRepo.find({
			where: { id: In(ids) },
			relations: ["status"],
		});

		const jobMap = new Map(jobs.map((j) => [j.id, j]));

		await Promise.all(
			data.map(async (item) => {
				const job = jobMap.get(item.id);

				if (!job?.status?.id) return;

				const status = String(item.status ?? "").toLowerCase();

				if (status === "in_progress" || status === "processing") {
					await this.markJobInProgress(job);
					return;
				}

				if (
					status === "completed" ||
					status === "success" ||
					status === "executed"
				) {
					await this.markJobSuccess(job, item.brokerOrderId);
					return;
				}

				if (status === "failed" || status === "error") {
					await this.markJobFailed(
						job,
						item.error ?? "execution_failed"
					);
					return;
				}

				await this.tradeSignalStatusRepo
					.createQueryBuilder()
					.update(TradeSignalStatus)
					.set({
						status: item.status,
						updatedAt: new Date(),
					})
					.where("tradeSignalId = :id", { id: item.id })
					.execute();
			})
		);
	}
}
