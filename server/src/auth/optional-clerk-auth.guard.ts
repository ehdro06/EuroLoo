import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OptionalClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(OptionalClerkAuthGuard.name);

  constructor(private configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) {
      // No token, proceed without attaching user
      return true;
    }

    try {
      const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
      if (!secretKey) {
          this.logger.error('CLERK_SECRET_KEY is missing in environment variables');
          // todo : If configuration is wrong, maybe shorter just to log and return true (treat as unauth) or throw?
          // what are the possible downsides? it could be a malicious attack... i'm not sure yet
          return true; 
      }

      // Verify the token
      const sessionClaims = await clerkClient.verifyToken(token, {
          secretKey,
      });

      // Attach the user to the request object
      // Map 'sub' (the standard JWT subject claim) to 'id' for convenience
      request.user = {
        ...sessionClaims,
        id: sessionClaims.sub,
      };
      
      return true;
    } catch (error) {
      this.logger.warn(`Token verification failed in Optional Guard: ${error.message}`);
      // In optional guard, if token is invalid, we proceed as unauthenticated user
      return true;
    }
  }
}
