-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_rideId_fkey";

-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "rideId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User"("name");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE SET NULL ON UPDATE CASCADE;
