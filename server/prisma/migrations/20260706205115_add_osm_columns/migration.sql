-- AlterTable
ALTER TABLE "Toilet" ADD COLUMN     "access" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "hasChangingTable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasDrinkingWater" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFemale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isIndoor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isUnisex" BOOLEAN NOT NULL DEFAULT false;
