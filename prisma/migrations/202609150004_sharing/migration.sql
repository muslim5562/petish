-- CreateTable
CREATE TABLE "HealthSummarySnapshot" (
    "id" UUID NOT NULL,
    "petId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "custodyId" UUID NOT NULL,
    "content" JSONB NOT NULL,
    "selection" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "draftExpiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthSummarySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthSummaryShare" (
    "id" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "HealthSummaryShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthSummarySnapshot_petId_createdAt_idx" ON "HealthSummarySnapshot"("petId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HealthSummaryShare_snapshotId_key" ON "HealthSummaryShare"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthSummaryShare_tokenHash_key" ON "HealthSummaryShare"("tokenHash");

-- CreateIndex
CREATE INDEX "HealthSummaryShare_expiresAt_revokedAt_idx" ON "HealthSummaryShare"("expiresAt", "revokedAt");

-- AddForeignKey
ALTER TABLE "HealthSummarySnapshot" ADD CONSTRAINT "HealthSummarySnapshot_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthSummarySnapshot" ADD CONSTRAINT "HealthSummarySnapshot_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthSummarySnapshot" ADD CONSTRAINT "HealthSummarySnapshot_custodyId_fkey" FOREIGN KEY ("custodyId") REFERENCES "PetOwnership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthSummaryShare" ADD CONSTRAINT "HealthSummaryShare_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "HealthSummarySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HealthSummaryShare" ADD CONSTRAINT "summary_hash_format" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "HealthSummaryShare" ADD CONSTRAINT "summary_expiry_after_creation" CHECK ("expiresAt" IS NULL OR "expiresAt" > "createdAt");
CREATE FUNCTION petish_immutable_summary() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Health summary snapshots are immutable'; END; $$;
CREATE TRIGGER immutable_health_summary BEFORE UPDATE ON "HealthSummarySnapshot" FOR EACH ROW EXECUTE FUNCTION petish_immutable_summary();
CREATE FUNCTION petish_immutable_share() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."tokenHash" IS DISTINCT FROM OLD."tokenHash" OR NEW."snapshotId" IS DISTINCT FROM OLD."snapshotId" OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" OR (OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt") THEN RAISE EXCEPTION 'Share access details cannot be changed or unrevoked'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER immutable_health_share BEFORE UPDATE ON "HealthSummaryShare" FOR EACH ROW EXECUTE FUNCTION petish_immutable_share();
CREATE FUNCTION petish_revoke_shares_on_custody_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."ownerId" IS DISTINCT FROM OLD."ownerId" THEN
 UPDATE "HealthSummaryShare" s SET "revokedAt"=CURRENT_TIMESTAMP FROM "HealthSummarySnapshot" p WHERE s."snapshotId"=p.id AND p."petId"=NEW.id AND s."revokedAt" IS NULL;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER revoke_health_shares_on_custody_change AFTER UPDATE OF "ownerId" ON "Pet" FOR EACH ROW EXECUTE FUNCTION petish_revoke_shares_on_custody_change();

