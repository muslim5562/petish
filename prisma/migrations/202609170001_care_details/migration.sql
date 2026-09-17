ALTER TABLE "Pet" ADD COLUMN "careType" TEXT NOT NULL DEFAULT 'INHOUSE', ADD COLUMN "normalLocation" TEXT;
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_care_type_check" CHECK ("careType" IN ('INHOUSE', 'CARE_STRAY'));
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_stray_location_check" CHECK ("careType" <> 'CARE_STRAY' OR length(trim("normalLocation")) > 0 AND "normalLocation" IS NOT NULL);
