import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  @MinLength(1)
  externalId!: string;

  @IsString()
  @MaxLength(2000)
  content!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;
}
