/*
  Warnings:

  - The `commission` column on the `Payment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `driverAmount` column on the `Payment` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "commission",
ADD COLUMN     "commission" DOUBLE PRECISION,
DROP COLUMN "driverAmount",
ADD COLUMN     "driverAmount" DOUBLE PRECISION;
