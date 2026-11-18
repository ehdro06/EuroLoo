import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import { displayNameFrom } from './display-name.js';

const getUser = jest.fn();
jest.mock('@clerk/backend', () => ({ createClerkClient: () => ({ users: { getUser } }) }));

import { UsersService } from './users.service.js';

describe('displayNameFrom', () => {
  it('prefers the username, then first name with last initial, never the email', () => {
    expect(displayNameFrom({ username: 'loofan', firstName: 'Jane' })).toBe('loofan');
    expect(displayNameFrom({ firstName: 'Jane', lastName: 'Doe' })).toBe('Jane D.');
    expect(displayNameFrom({ firstName: 'Jane' })).toBe('Jane');
    expect(displayNameFrom({})).toBe('Traveler');
  });
});

describe('UsersService.ensureUser', () => {
  let prisma: { user: { upsert: jest.Mock; update: jest.Mock } };
  let service: UsersService;

  beforeEach(() => {
    getUser.mockReset();
    prisma = { user: { upsert: jest.fn(), update: jest.fn() } };
    service = new UsersService(prisma as unknown as PrismaService, { get: () => 'sk_test' } as unknown as ConfigService);
  });

  it('does not call Clerk when the user already has a name', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 1, clerkId: 'u1', username: 'loofan' });
    await expect(service.ensureUser('u1')).resolves.toMatchObject({ username: 'loofan' });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('fills in a missing name from the Clerk profile', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 1, clerkId: 'u1', username: null });
    getUser.mockResolvedValue({ username: null, firstName: 'Jane', lastName: 'Doe' });
    prisma.user.update.mockImplementation(({ data }) => ({ id: 1, clerkId: 'u1', ...data }));

    await expect(service.ensureUser('u1')).resolves.toMatchObject({ username: 'Jane D.' });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { clerkId: 'u1' }, data: { username: 'Jane D.' } });
  });

  it('still returns the user when Clerk is unavailable', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 1, clerkId: 'u1', username: null });
    getUser.mockRejectedValue(new Error('network'));
    await expect(service.ensureUser('u1')).resolves.toMatchObject({ id: 1 });
  });
});

describe('UsersService.deleteAccountData', () => {
  it('deletes votes, reviews, photos and the user, keeping added toilets without a contributor', async () => {
    const calls: string[] = [];
    const record = (name: string) => jest.fn().mockImplementation(() => calls.push(name));
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 7 }), delete: record('user.delete') },
      image: {
        findMany: jest.fn().mockResolvedValue([{ url: 'https://storage.googleapis.com/b/a.jpg' }]),
        deleteMany: record('image.deleteMany'),
      },
      vote: { deleteMany: record('vote.deleteMany') },
      review: { deleteMany: record('review.deleteMany') },
      toilet: { updateMany: record('toilet.updateMany') },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const service = new UsersService(prisma as unknown as PrismaService, { get: () => 'sk' } as unknown as ConfigService);

    await expect(service.deleteAccountData('u1')).resolves.toEqual({
      imageUrls: ['https://storage.googleapis.com/b/a.jpg'],
    });
    expect(calls).toEqual(['vote.deleteMany', 'review.deleteMany', 'image.deleteMany', 'toilet.updateMany', 'user.delete']);
    expect(prisma.toilet.updateMany).toHaveBeenCalledWith({ where: { contributorId: 7 }, data: { contributorId: null } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an unknown user', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn() };
    const service = new UsersService(prisma as unknown as PrismaService, { get: () => 'sk' } as unknown as ConfigService);

    await expect(service.deleteAccountData('ghost')).resolves.toEqual({ imageUrls: [] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
