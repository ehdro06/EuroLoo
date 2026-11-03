import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
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

    // A missing key is a server problem, not the user's, so don't report it as a bad token
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      this.logger.error('CLERK_SECRET_KEY is missing in environment variables');
      throw new InternalServerErrorException('Authentication is not configured on the server');
    }

    try {
      // Verify the token
      const sessionClaims = await verifyToken(token, {
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
      this.logger.error(`Token verification failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
