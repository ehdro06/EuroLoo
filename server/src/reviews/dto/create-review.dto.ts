import { IsInt, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  externalId: string;

  @IsString()
  content: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}
