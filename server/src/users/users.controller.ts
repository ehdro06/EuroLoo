import { Controller, Get, Post, Body, Param, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { UsersService } from './users.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Role } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  async getMe(@Req() req: any) {
    // req.user has been populated by ClerkAuthGuard
    // but the `role` might not be up-to-date in the token or we want 
    // to unify how we check permissions.
    // Fetch the DB user to get the true role.
    const user = await this.usersService.findByClerkId(req.user.id);
    return user;
  }

  @Get()
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getAllUsers() {
    return this.usersService.findAll();
  }

  @Post(':clerkId/role')
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateUserRole(
    @Param('clerkId') clerkId: string, 
    @Body('role') role: Role
  ) {
    if (!['USER', 'ADMIN'].includes(role)) {
        throw new ForbiddenException('Invalid role');
    }
    return this.usersService.setRole(clerkId, role);
  }
}
