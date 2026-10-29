import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UsersService } from '../users/users.service.js';

describe('ReviewsService', () => {
  let prisma: { review: Record<string, jest.Mock> };
  let usersService: { ensureUser: jest.Mock; findByClerkId: jest.Mock };
  let service: ReviewsService;

  beforeEach(() => {
    prisma = {
      review: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    usersService = {
      ensureUser: jest.fn().mockResolvedValue({ id: 3, clerkId: 'author' }),
      findByClerkId: jest.fn(),
    };
    service = new ReviewsService(prisma as unknown as PrismaService, usersService as unknown as UsersService);
  });

  it('creates a review attributed to the signed-in user', async () => {
    await service.create({ externalId: 'node/1', content: 'Clean', rating: 5 }, 'author');

    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ author: { connect: { id: 3 } }, toilet: { connect: { externalId: 'node/1' } } }),
      }),
    );
  });

  describe('update / remove', () => {
    beforeEach(() => {
      prisma.review.findUnique.mockResolvedValue({ author: { clerkId: 'author' } });
    });

    it('lets the author edit their review', async () => {
      await service.update(1, { rating: 4 }, 'author');

      expect(prisma.review.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 }, data: { rating: 4 } }));
    });

    it('forbids other users', async () => {
      usersService.findByClerkId.mockResolvedValue({ role: 'USER' });

      await expect(service.remove(1, 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.review.delete).not.toHaveBeenCalled();
    });

    it('lets an admin delete any review', async () => {
      usersService.findByClerkId.mockResolvedValue({ role: 'ADMIN' });

      await expect(service.remove(1, 'admin')).resolves.toEqual({ success: true });
      expect(prisma.review.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('returns 404 for a missing review', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.update(99, { rating: 1 }, 'author')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
