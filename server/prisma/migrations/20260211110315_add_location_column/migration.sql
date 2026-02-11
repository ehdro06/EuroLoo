-- AlterTable
ALTER TABLE "Toilet" ADD COLUMN     "location" geometry(Point, 4326);

-- Backfill location data
UPDATE "Toilet" SET location = ST_SetSRID(ST_MakePoint(lon, lat), 4326);

-- Create Index
CREATE INDEX "Toilet_location_idx" ON "Toilet" USING GIST ("location");
