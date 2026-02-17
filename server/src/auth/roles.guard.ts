import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.id) {
        return false;
    }

    // We assume the user has been authenticated and attached to the request (e.g. by ClerkAuthGuard) based on their Clerk ID
    // We now fetch their role from our DB.
    // Optimization: In a real app, cache this or include role in Clerk metadata.
    const dbUser = await this.prisma.user.findUnique({
        where: { clerkId: user.id } // user.id here is the 'sub' from Clerk JWT
    });

    if (!dbUser) {
        return false;
    }

    return requiredRoles.some((role) => dbUser.role === role);
  }
}
