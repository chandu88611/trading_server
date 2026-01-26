export interface IUserSubscribePayload {
  planId: string;
}

export interface IUserSubscriptionCancelPayload {
  cancelAtPeriodEnd: boolean;
}

export interface IUserSubscriptionQuery {
  userId: number;
}
