ALTER TABLE "TicketType"
ADD COLUMN "capacity" INTEGER,
ADD COLUMN "slotsAvailable" INTEGER,
ADD COLUMN "slotsReserved" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "slotsSold" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "TicketOrder"
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "reservationReleasedAt" TIMESTAMP(3);

UPDATE "TicketType" AS ticket
SET "slotsSold" = COALESCE(sales."soldSlots", 0)
FROM (
  SELECT "ticketTypeId", SUM("quantity")::INTEGER AS "soldSlots"
  FROM "TicketOrder"
  WHERE "status" = 'PAID'
  GROUP BY "ticketTypeId"
) AS sales
WHERE ticket."id" = sales."ticketTypeId";

UPDATE "TicketOrder"
SET
  "expiresAt" = "createdAt" + INTERVAL '30 minutes',
  "reservationReleasedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'PENDING';

CREATE INDEX "TicketOrder_status_expiresAt_idx"
ON "TicketOrder"("status", "expiresAt");
