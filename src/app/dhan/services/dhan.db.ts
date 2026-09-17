import { encryptCredentials, encrypt } from "../../../utils/crypto";
import { In, Repository } from "typeorm";
import AppDataSource from "../../../db/data-source";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";
import { TradeSignal } from "../../../entity/TradeSignals";
import { TradeSignalStatus } from "../../../entity/TradeSignalsStatus";

export class DhanDB {
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
			where: { id, userId },
			relations: ["broker"],
		});
	}

	async updateAccountMeta(account: UserTradingAccount, metaPatch: Record<string, any>) {
		const nextMeta = { ...(account.accountMeta ?? {}), ...metaPatch };
		account.accountMeta = encryptCredentials(nextMeta);
        if (account.accessToken) account.accessToken = encrypt(account.accessToken);
        if (account.refreshToken) account.refreshToken = encrypt(account.refreshToken);
		if(metaPatch?.dhan?.accessToken) {
            account.lastVerifiedAt = new Date();
			account.accessToken = encrypt(nextMeta.dhan.accessToken ?? account.accessToken);
		}
		return this.accountRepo.save(account);
	}

	async markJobInProgress(job: TradeSignal) {
		await this.tradeSignalRepo.manager.query(
			`UPDATE trade_signals_status SET status='in_progress' WHERE id=$1`,
			[job.status.id]
		);
	}

	async markJobSuccess(job: TradeSignal) {
		await this.tradeSignalRepo.manager.query(
			`UPDATE trade_signals_status SET status='completed' WHERE id=$1`,
			[job.status.id]
		);
	}

	async markJobFailed(job: TradeSignal, error: string) {
		void error;
		await this.tradeSignalRepo.manager.query(
			`
			UPDATE trade_signals_status
			SET status='failed',
					attempts=attempts+1
			WHERE id=$1
			`,
			[job.status.id]
		);
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
				.innerJoin("s.tradeSignal", "ts")
				.innerJoin("ts.tradingAccount", "ta")
				.innerJoin("ta.broker", "b")
				.where("s.status = :status", { status: "pending" })
				.andWhere("(b.code = :code OR b.name = :name)", { code: "DHAN", name: "Dhan" })
				.orderBy("s.tradeSignalId", "ASC")
				.limit(limit)
				.setLock("pessimistic_write");

			if (typeof qb.setOnLocked === "function") qb.setOnLocked("skip_locked");

			const rows: Array<{ id: any }> = await qb.getRawMany();
			const ids = rows.map((r) => Number(r.id)).filter(Boolean);

			if (!ids.length) {
				await qr.commitTransaction();
				return [] as TradeSignal[];
			}

			await statusRepo
				.createQueryBuilder()
				.update(TradeSignalStatus)
				.set({ status: "in_progress", updatedAt: new Date() })
				.where("tradeSignalId IN (:...ids)", { ids })
				.execute();

			const signals = await qr.manager
				.getRepository(TradeSignal)
				.createQueryBuilder("ts")
				.leftJoinAndSelect("ts.tradingAccount", "ta")
				.leftJoinAndSelect("ta.broker", "b")
				.leftJoinAndSelect("ts.status", "tss")
				.where("ts.id IN (:...ids)", { ids })
				.andWhere("(b.code = :code OR b.name = :name)", { code: "DHAN", name: "Dhan" })
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

	async updateTradeStatus(data: { id: number; status: string; error?: string; brokerOrderId?: string }[]) {
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
        if (item.brokerOrderId) await this.tradeSignalRepo.update(job.id, { brokerOrderId: item.brokerOrderId });

				const status = String(item.status ?? "").toLowerCase();

				if (status === "in_progress" || status === "processing") {
					await this.markJobInProgress(job);
					return;
				}

				if (status === "completed" || status === "success" || status === "executed") {
					await this.markJobSuccess(job);
					return;
				}

				if (status === "failed" || status === "error") {
					await this.markJobFailed(job, item.error ?? "execution_failed");
					return;
				}

				await this.tradeSignalStatusRepo
					.createQueryBuilder()
					.update(TradeSignalStatus)
					.set({ status: item.status, updatedAt: new Date() })
					.where("tradeSignalId = :id", { id: item.id })
					.execute();
			})
		);
	}
}
