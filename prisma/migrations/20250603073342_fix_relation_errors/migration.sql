-- DropForeignKey
ALTER TABLE "BookingRequest" DROP CONSTRAINT "BookingRequest_rideId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_rideId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_rideId_fkey";

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "commission" SET DATA TYPE TEXT,
ALTER COLUMN "driverAmount" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "payment_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;
