export interface ICreateBrokerCredential {
  userId: number;
  keyName?: string | null;
  encApiKey?: string | null;
  encApiSecret?: string | null;
  encRequestToken?: string | null;
  status?: string;
}

export interface IUpdateBrokerCredential {
  keyName?: string | null;
  encApiKey?: string | null;
  encApiSecret?: string | null;
  encRequestToken?: string | null;
  status?: string;
}
