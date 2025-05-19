-- Додаємо стовпці як необов’язкові
ALTER TABLE "Conversation"
ADD COLUMN "category" TEXT,
ADD COLUMN "targetUserId" TEXT;

-- Заповнюємо category (припустимо, всі існуючі розмови належать до категорії 'Passengers')
UPDATE "Conversation"
SET "category" = 'Passengers'
WHERE "category" IS NULL;

-- Заповнюємо targetUserId (беремо passengerId або driverId із пов’язаної поїздки)
UPDATE "Conversation"
SET "targetUserId" = (
    SELECT COALESCE("passengerId", "driverId")
    FROM "Ride"
    WHERE "Ride"."id" = "Conversation"."rideId"
    LIMIT 1
)
WHERE "rideId" IS NOT NULL;

-- Для розмов без rideId присвоюємо userId
UPDATE "Conversation"
SET "targetUserId" = "userId"
WHERE "targetUserId" IS NULL;

-- Робимо стовпці обов’язковими
ALTER TABLE "Conversation"
ALTER COLUMN "category" SET NOT NULL,
ALTER COLUMN "targetUserId" SET NOT NULL;

-- Додаємо зовнішній ключ
ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;