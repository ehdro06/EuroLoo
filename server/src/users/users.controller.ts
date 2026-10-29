import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { UsersService } from './users.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SimpleRateLimitGuard } from '../common/guards/simple-rate-limit.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  async getMe(@Req() req: AuthenticatedRequest) {
    // The role in the JWT may be stale, so the database is the source of truth
    return this.usersService.findByClerkId(req.user.id);
  }

  @Get()
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getAllUsers() {
    return this.usersService.findAll();
  }

  @Post(':clerkId/role')
  @UseGuards(ClerkAuthGuard, RolesGuard, SimpleRateLimitGuard)
  @Roles('ADMIN')
  async updateUserRole(@Param('clerkId') clerkId: string, @Body() dto: UpdateRoleDto) {
    return this.usersService.setRole(clerkId, dto.role);
  }
}
