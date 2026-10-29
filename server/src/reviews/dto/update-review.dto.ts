import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateReviewDto } from './create-review.dto.js';

// A review can't be moved to another toilet, so externalId is not editable
export class UpdateReviewDto extends PartialType(PickType(CreateReviewDto, ['content', 'rating'] as const)) {}
