import { SubscriberTradeAlertListQuery, TradeAlertDBService } from "./tradeAlert.db";

export class TradeAlertService {
  private db = new TradeAlertDBService();

  listForUser(userId: number, query: SubscriberTradeAlertListQuery) {
    return this.db.listForUser(userId, query);
  }

  markRead(userId: number, alertId: number) {
    return this.db.markRead(userId, alertId);
  }

  markAllRead(userId: number) {
    return this.db.markAllRead(userId);
  }
}
