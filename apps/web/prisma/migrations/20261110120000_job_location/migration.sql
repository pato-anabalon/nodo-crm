-- Where a job is, for the clock to measure punches against.

-- CreateEnum
CREATE TYPE "JobLocationSource" AS ENUM ('GEOCODED', 'MANUAL');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "geocodedAddress" TEXT,
ADD COLUMN     "geofenceRadiusM" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "locationSource" "JobLocationSource",
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- A place is both halves and says how it was set, or it is none of the three.
ALTER TABLE "Job" ADD CONSTRAINT "Job_location_whole" CHECK (
  ("latitude" IS NULL AND "longitude" IS NULL AND "locationSource" IS NULL)
  OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "locationSource" IS NOT NULL)
);
ALTER TABLE "Job" ADD CONSTRAINT "Job_geofence_radius" CHECK ("geofenceRadiusM" BETWEEN 50 AND 5000);
