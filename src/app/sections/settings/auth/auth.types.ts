export interface AuthProvider {
  provider: string; // rename to name
  email: string;
  createdAt: string;
  updatedAt: string;
  lastPasswordResetDate?: string; // Only for local provider
}

export interface TokenInfo {
  email: string;
  expiresAt: Date;
}
