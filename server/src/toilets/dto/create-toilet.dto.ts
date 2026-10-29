import { IsBoolean, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateToiletDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  // The submitter's own position, used to check they are near the toilet
  @IsLatitude()
  userLat!: number;

  @IsLongitude()
  userLng!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  operator?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  fee?: string;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  openingHours?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  wheelchair?: string;

  @IsOptional()
  @IsBoolean()
  isAccessible?: boolean;
}
