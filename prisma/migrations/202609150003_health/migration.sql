-- CreateEnum
CREATE TYPE "HealthKind" AS ENUM ('VISIT', 'MEDICATION', 'VACCINATION', 'PROBLEM', 'ALLERGY', 'PROCEDURE', 'DOCUMENT', 'NOTE');

-- CreateEnum
CREATE TYPE "HealthSource" AS ENUM ('OWNER_ENTERED', 'COPIED_VET_RECORD', 'IMPORTED_DOCUMENT');

-- CreateEnum
CREATE TYPE "HealthDatePrecision" AS ENUM ('EXACT', 'APPROXIMATE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TreatmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'STOPPED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProblemStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "HealthRecord" (
    "id" UUID NOT NULL,
    "petId" UUID NOT NULL,
    "kind" "HealthKind" NOT NULL,
    "title" TEXT NOT NULL,
    "occurredOn" DATE,
    "datePrecision" "HealthDatePrecision" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "sourceType" "HealthSource" NOT NULL DEFAULT 'OWNER_ENTERED',
    "sourceClinic" TEXT,
    "enteredBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,
    "linkedEncounterId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "recordId" UUID NOT NULL,
    "vetSaid" TEXT,
    "treatment" TEXT,
    "outcome" TEXT,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("recordId")
);

-- CreateTable
CREATE TABLE "Medication" (
    "recordId" UUID NOT NULL,
    "instructions" TEXT,
    "indication" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "status" "TreatmentStatus" NOT NULL DEFAULT 'UNKNOWN',

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("recordId")
);

-- CreateTable
CREATE TABLE "Vaccination" (
    "recordId" UUID NOT NULL,
    "nextDueDate" DATE,
    "batch" TEXT,

    CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("recordId")
);

-- CreateTable
CREATE TABLE "MedicalProblem" (
    "recordId" UUID NOT NULL,
    "status" "ProblemStatus" NOT NULL DEFAULT 'UNKNOWN',

    CONSTRAINT "MedicalProblem_pkey" PRIMARY KEY ("recordId")
);

-- CreateTable
CREATE TABLE "Allergy" (
    "recordId" UUID NOT NULL,
    "reaction" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'UNKNOWN',

    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("recordId")
);

-- CreateTable
CREATE TABLE "Procedure" (
    "recordId" UUID NOT NULL,
    "outcome" TEXT,
    "major" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("recordId")
);

-- CreateTable
CREATE TABLE "HealthRevision" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "thumbKey" TEXT,
    "filename" TEXT NOT NULL,
    "description" TEXT,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "uploadedBy" UUID NOT NULL,
    "transferable" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetHealthContext" (
    "petId" UUID NOT NULL,
    "emergencyNotes" TEXT,
    "allergyKnowledge" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "updatedBy" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetHealthContext_pkey" PRIMARY KEY ("petId")
);

-- CreateTable
CREATE TABLE "HealthContextRevision" (
    "id" UUID NOT NULL,
    "petId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "actorId" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthContextRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthRecord_petId_deletedAt_occurredOn_idx" ON "HealthRecord"("petId", "deletedAt", "occurredOn");

-- CreateIndex
CREATE UNIQUE INDEX "HealthRevision_recordId_version_key" ON "HealthRevision"("recordId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_objectKey_key" ON "Attachment"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_thumbKey_key" ON "Attachment"("thumbKey");

-- CreateIndex
CREATE INDEX "Attachment_recordId_deletedAt_idx" ON "Attachment"("recordId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HealthContextRevision_petId_version_key" ON "HealthContextRevision"("petId", "version");

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_linkedEncounterId_fkey" FOREIGN KEY ("linkedEncounterId") REFERENCES "HealthRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "HealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "HealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "HealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalProblem" ADD CONSTRAINT "MedicalProblem_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "HealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "HealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "HealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRevision" ADD CONSTRAINT "HealthRevision_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "HealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "HealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetHealthContext" ADD CONSTRAINT "PetHealthContext_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthContextRevision" ADD CONSTRAINT "HealthContextRevision_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
