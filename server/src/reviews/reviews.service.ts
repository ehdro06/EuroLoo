import { Injectable } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(createReviewDto: CreateReviewDto, clerkId?: string) {
    const { externalId, content, rating } = createReviewDto;
    return this.prisma.review.create({
      data: {
        content,
        rating,
        toilet: {
          connect: {
            externalId,
          },
        },
        author: clerkId ? {
          connect: { clerkId },
        } : undefined,
      },
      include: {
        author: {
          select: {
            username: true,
            id: true,
            clerkId: true,
          }
        }
      }
    });
  }

  findAll() {
    return this.prisma.review.findMany();
  }

  findOne(id: number) {
    return this.prisma.review.findUnique({
      where: { id },
    });
  }

  findAllByToilet(externalId: string) {
    return this.prisma.review.findMany({
      where: {
        toilet: {
          externalId,
        },
      },
      include: {
        author: {
          select: {
            username: true,
            id: true,
            clerkId: true,
            // Maybe add reputation later
          }
        }
      },
      orderBy: {
        id: 'desc',
      },
    });
  }

  update(id: number, updateReviewDto: UpdateReviewDto) {
    return `This action updates a #${id} review`;
  }

  remove(id: number) {
    return `This action removes a #${id} review`;
  }
}
