export interface ICreateBrokerJob {
  credentialId: number;
  type: string;
  payload?: Record<string, any> | null;
}

export interface IUpdateBrokerJob {
  payload?: Record<string, any> | null;
  attempts?: number;
  lastError?: string | null;
  status?: string;
}
