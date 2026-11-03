-- AlterTable
ALTER TABLE "Toilet" ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "osmDeletedAt" TIMESTAMP(3),
ADD COLUMN     "osmSyncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Toilet_countryCode_idx" ON "Toilet"("countryCode");
