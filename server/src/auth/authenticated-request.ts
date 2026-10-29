import type { Request } from 'express';

// Populated by ClerkAuthGuard from the verified JWT.
export interface AuthUser {
  id: string; // Clerk user ID (JWT `sub`)
  [claim: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
