export interface AuthProvider {
  provider: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  lastPasswordResetDate?: string; // Only for local provider
}

export interface TokenInfo {
  email: string;
  expiresAt: Date;
}
