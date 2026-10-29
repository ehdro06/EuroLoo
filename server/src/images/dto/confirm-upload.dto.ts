import { IsInt, IsPositive, IsString, MaxLength } from 'class-validator';

export class ConfirmUploadDto {
  @IsInt()
  @IsPositive()
  toiletId!: number;

  @IsString()
  @MaxLength(512)
  fileUrl!: string;
}
