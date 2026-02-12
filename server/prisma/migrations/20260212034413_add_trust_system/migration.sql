-- DropIndex
DROP INDEX "Toilet_location_idx";

-- AlterTable
ALTER TABLE "Toilet" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verifyCount" INTEGER NOT NULL DEFAULT 0;
