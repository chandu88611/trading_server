import { AlertSnapshotDB } from "../db/alertSnapshot.db";
import { ICreateAlertSnapshot } from "../interfaces/alertSnapshot.interface";

export class AlertSnapshotService {
  private db = new AlertSnapshotDB();

  async create(payload: ICreateAlertSnapshot) {
    return this.db.create(payload);
  }

  async listByJob(jobId: number) {
    return this.db.listByJob(jobId);
  }
}
