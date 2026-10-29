import { IsIn } from 'class-validator';

// Only raster formats; SVG is excluded because it can carry scripts.
export const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type AllowedImageType = keyof typeof ALLOWED_IMAGE_TYPES;

export class PresignedUrlDto {
  @IsIn(Object.keys(ALLOWED_IMAGE_TYPES))
  contentType!: AllowedImageType;
}
