export interface ICreateBrokerSession {
  credentialId: number;
  sessionToken?: string | null;
  expiresAt?: Date | null;
  lastRefreshedAt?: Date | null;
}

export interface IUpdateBrokerSession {
  sessionToken?: string | null;
  expiresAt?: Date | null;
  lastRefreshedAt?: Date | null;
  status?: string;
}
