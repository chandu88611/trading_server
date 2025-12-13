export interface ICreateCheckoutPayload {
  planId: number;            
}

export interface IStripeCheckoutResponse {
  url: string;
  sessionId: string;
}
