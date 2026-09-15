export interface AuthMethod {
  provider: string; // user provider
  email: string;
}

export interface TokenInfo {
  email: string;
  expiresAt: Date;
}

// TODO
export enum Provider {
  local = 'local',
  google = 'google',
  apple = 'apple',
}
