-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "paymentType" TEXT DEFAULT 'both',
ADD COLUMN     "selectedCardId" TEXT;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_selectedCardId_fkey" FOREIGN KEY ("selectedCardId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
