import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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

  // Omitted when the reviewer isn't sure
  @IsOptional()
  @IsBoolean()
  isWheelchairAccessible?: boolean;

  @IsOptional()
  @IsBoolean()
  hasChangingTable?: boolean;
}
