import { ExecutionContext, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ClerkAuthGuard } from './clerk-auth.guard.js';

const contextWithAuth = (authorization?: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers: authorization ? { authorization } : {} }) }),
  }) as unknown as ExecutionContext;

const guardWithSecret = (secret?: string) =>
  new ClerkAuthGuard({ get: () => secret } as unknown as ConfigService);

describe('ClerkAuthGuard', () => {
  it('rejects requests without a token with 401', async () => {
    await expect(guardWithSecret('sk_test_x').canActivate(contextWithAuth())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('reports a missing CLERK_SECRET_KEY as a server error, not a bad token', async () => {
    await expect(guardWithSecret(undefined).canActivate(contextWithAuth('Bearer abc'))).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('rejects a malformed token with 401', async () => {
    await expect(
      guardWithSecret('sk_test_x').canActivate(contextWithAuth('Bearer not-a-jwt')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
