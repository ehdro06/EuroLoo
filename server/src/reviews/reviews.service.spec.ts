import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });


  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
