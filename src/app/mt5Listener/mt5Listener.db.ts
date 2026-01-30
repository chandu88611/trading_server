import { DataSource } from "typeorm";

export class Mt5ListenerDBServices {
  constructor(private readonly dataSource: DataSource) {}

  async getNextPendingJob(brokerAccountId: string) {
    const sql = `
      SELECT
        bj.id              AS job_id,
        ts.action          AS side,
        ts.symbol,
        ts.price,
        COALESCE((bj.payload->>'qty')::numeric, 0) AS qty
      FROM broker_jobs bj
      JOIN broker_credentials bc ON bc.id = bj.credential_id
      JOIN trade_signals ts ON ts.job_id = bj.id
      WHERE
        bc.broker_account_id = $1     -- 🔴 MT5 login
        AND bj.status = 'pending'
      ORDER BY bj.created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const rows = await this.dataSource.manager.query(sql, [
      brokerAccountId,
    ]);
    console.log("Rows Fetched ::: ",rows);

    return rows[0] ?? null;
  }

  async markJobInProgress(jobId: number) {
    await this.dataSource.manager.query(
      `UPDATE broker_jobs SET status='in_progress' WHERE id=$1`,
      [jobId]
    );
  }

  async markJobSuccess(jobId: number) {
    await this.dataSource.manager.query(
      `UPDATE broker_jobs SET status='completed' WHERE id=$1`,
      [jobId]
    );
  }

  async markJobFailed(jobId: number, error: string) {
    await this.dataSource.manager.query(
      `
      UPDATE broker_jobs
      SET status='failed',
          last_error=$2,
          attempts=attempts+1
      WHERE id=$1
      `,
      [jobId, error]
    );
  }
}
