import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { isRecordNotFoundError } from '../common/prisma-errors.js';

const authorSelect = {
  select: {
    username: true,
    id: true,
    clerkId: true,
  },
};

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  async create(createReviewDto: CreateReviewDto, clerkId: string) {
    const { externalId, content, rating } = createReviewDto;
    const author = await this.usersService.ensureUser(clerkId);

    try {
      return await this.prisma.review.create({
        data: {
          content,
          rating,
          toilet: { connect: { externalId } },
          author: { connect: { id: author.id } },
        },
        include: { author: authorSelect },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) throw new NotFoundException('Toilet not found');
      throw error;
    }
  }

  findAll() {
    return this.prisma.review.findMany();
  }

  async findOne(id: number) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  findAllByToilet(externalId: string) {
    return this.prisma.review.findMany({
      where: { toilet: { externalId } },
      include: { author: authorSelect },
      orderBy: { id: 'desc' },
    });
  }

  async update(id: number, updateReviewDto: UpdateReviewDto, clerkId: string) {
    await this.assertCanModify(id, clerkId);
    return this.prisma.review.update({
      where: { id },
      data: updateReviewDto,
      include: { author: authorSelect },
    });
  }

  async remove(id: number, clerkId: string) {
    await this.assertCanModify(id, clerkId);
    await this.prisma.review.delete({ where: { id } });
    return { success: true };
  }

  // Only the author of a review or an admin may change it
  private async assertCanModify(reviewId: number, clerkId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { author: { select: { clerkId: true } } },
    });
    if (!review) throw new NotFoundException('Review not found');

    if (review.author?.clerkId === clerkId) return;

    const user = await this.usersService.findByClerkId(clerkId);
    if (user?.role !== 'ADMIN') {
      throw new ForbiddenException('You can only modify your own reviews');
    }
  }
}
