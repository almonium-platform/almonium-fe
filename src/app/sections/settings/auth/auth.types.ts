export interface AuthProvider {
  provider: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface TokenInfo {
  email: string;
  expiresAt: Date;
}
