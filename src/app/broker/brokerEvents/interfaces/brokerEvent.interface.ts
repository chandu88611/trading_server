export interface ICreateBrokerEvent {
  jobId: number;
  eventType: string;
  payload?: Record<string, any> | null;
}
