-- CreateTable
CREATE TABLE "BoardReport" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "ownerId" UUID,
    "petId" UUID,
    "email" TEXT NOT NULL,
    "petName" TEXT,
    "species" TEXT NOT NULL,
    "breed" TEXT,
    "colour" TEXT,
    "details" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "occurredAt" DATE NOT NULL,
    "approximateTime" TEXT,
    "custody" TEXT,
    "phone" TEXT,
    "publicPhone" BOOLEAN NOT NULL DEFAULT false,
    "reward" TEXT,
    "photoReuse" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closureReason" TEXT,
    "remindedAt" TIMESTAMP(3),
    "importedPetId" UUID,

    CONSTRAINT "BoardReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardResponse" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "kind" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "occurredAt" DATE NOT NULL,
    "details" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardPhoto" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "responseId" UUID,
    "objectKey" TEXT NOT NULL,
    "thumbKey" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,

    CONSTRAINT "BoardPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardAccess" (
    "id" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "reportId" UUID NOT NULL,
    "responseId" UUID,
    "kind" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardNotification" (
    "id" UUID NOT NULL,
    "ownerId" UUID,
    "reportId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardFlag" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardRate" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardReport_state_confirmedAt_idx" ON "BoardReport"("state", "confirmedAt");

-- CreateIndex
CREATE INDEX "BoardReport_ownerId_createdAt_idx" ON "BoardReport"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "BoardResponse_reportId_createdAt_idx" ON "BoardResponse"("reportId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BoardPhoto_objectKey_key" ON "BoardPhoto"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "BoardPhoto_thumbKey_key" ON "BoardPhoto"("thumbKey");

-- CreateIndex
CREATE UNIQUE INDEX "BoardAccess_tokenHash_key" ON "BoardAccess"("tokenHash");

-- CreateIndex
CREATE INDEX "BoardNotification_ownerId_readAt_idx" ON "BoardNotification"("ownerId", "readAt");

-- AddForeignKey
ALTER TABLE "BoardResponse" ADD CONSTRAINT "BoardResponse_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "BoardReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardPhoto" ADD CONSTRAINT "BoardPhoto_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "BoardReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardPhoto" ADD CONSTRAINT "BoardPhoto_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "BoardResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardAccess" ADD CONSTRAINT "BoardAccess_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "BoardReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardAccess" ADD CONSTRAINT "BoardAccess_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "BoardResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardFlag" ADD CONSTRAINT "BoardFlag_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "BoardReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
