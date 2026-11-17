CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

CREATE TABLE "TicketType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "authorizationUrl" TEXT,
    "accessCode" TEXT,
    "gatewayTransactionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "ticketTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TicketType_slug_key" ON "TicketType"("slug");
CREATE UNIQUE INDEX "TicketOrder_reference_key" ON "TicketOrder"("reference");
CREATE INDEX "TicketOrder_email_createdAt_idx" ON "TicketOrder"("email", "createdAt");

ALTER TABLE "TicketOrder"
ADD CONSTRAINT "TicketOrder_ticketTypeId_fkey"
FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
