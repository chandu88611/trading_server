export interface IUserSubscribePayload {
  planId: number;
}

export interface IUserSubscriptionCancelPayload {
  cancelAtPeriodEnd: boolean;
}

export interface IUserSubscriptionQuery {
  userId: number;
}
