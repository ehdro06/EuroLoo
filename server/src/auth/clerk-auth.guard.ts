import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(private configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) {
      this.logger.warn('No token provided');
      throw new UnauthorizedException('No token provided');
    }

    try {
      const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
      if (!secretKey) {
          this.logger.error('CLERK_SECRET_KEY is missing in environment variables');
          throw new UnauthorizedException('Server configuration error');
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
      this.logger.error(`Token verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
