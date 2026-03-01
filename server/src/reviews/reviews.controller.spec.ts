import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';
import { ConfigService } from '@nestjs/config';

describe('ReviewsController', () => {
  let controller: ReviewsController;

  const mockReviewsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      // return value based on key if needed
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: mockReviewsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        }
      ],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
