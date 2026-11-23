import { IsInt, IsPositive, IsString, MaxLength } from 'class-validator';

export class ConfirmUploadDto {
  @IsInt()
  @IsPositive()
  toiletId!: number;

  // The pending object name returned by POST /images/presigned-url
  @IsString()
  @MaxLength(128)
  uploadId!: string;
}
