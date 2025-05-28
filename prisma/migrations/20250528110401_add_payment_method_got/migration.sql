/*
  Warnings:

  - Added the required column `paymentMethod` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentMethod" TEXT NOT NULL,
ALTER COLUMN "stripePaymentIntentId" DROP NOT NULL,
ALTER COLUMN "commission" DROP NOT NULL,
ALTER COLUMN "driverAmount" DROP NOT NULL;
