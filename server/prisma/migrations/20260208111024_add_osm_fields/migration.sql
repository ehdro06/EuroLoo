/*
  Warnings:

  - Added the required column `lat` to the `Toilet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lon` to the `Toilet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Toilet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Toilet" ADD COLUMN     "fee" TEXT,
ADD COLUMN     "isAccessible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFree" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lat" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "lon" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "openingHours" TEXT,
ADD COLUMN     "operator" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "wheelchair" TEXT;

-- CreateIndex
CREATE INDEX "Toilet_lat_lon_idx" ON "Toilet"("lat", "lon");
