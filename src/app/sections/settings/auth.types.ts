export interface AuthProvider {
  provider: string;
  emailVerified: boolean;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface TokenInfo {
  email: string;
  expiresAt: Date;
}
