-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "endCoordsLat" DOUBLE PRECISION,
ADD COLUMN     "endCoordsLng" DOUBLE PRECISION,
ADD COLUMN     "startCoordsLat" DOUBLE PRECISION,
ADD COLUMN     "startCoordsLng" DOUBLE PRECISION,
ADD COLUMN     "vehicleType" TEXT;
