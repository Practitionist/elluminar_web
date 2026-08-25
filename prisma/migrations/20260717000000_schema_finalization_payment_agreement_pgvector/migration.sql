-- Schema finalization (issue #43): the FINAL pre-launch additive migration.
-- After this, the schema is frozen — prisma/** changes require the `schema-approved` label (CI-enforced).

-- pgvector, pre-authorized for the post-MVP AI tutor RAG index (issue #4).
-- Extension only; no core-table changes. Local dev: `brew install pgvector` for Homebrew PG16.
CREATE EXTENSION IF NOT EXISTS vector;

-- PaymentAgreement (pre-authorized additive table from issue #25, income-share/success-fee).
-- Ships empty; the feature itself remains post-MVP.

-- CreateEnum
CREATE TYPE "PaymentAgreementKind" AS ENUM ('SUCCESS_FEE');

-- CreateEnum
CREATE TYPE "PaymentAgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'TRIGGERED', 'SETTLED', 'WAIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PaymentAgreement" (
    "id" TEXT NOT NULL,
    "kind" "PaymentAgreementKind" NOT NULL DEFAULT 'SUCCESS_FEE',
    "userId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "termsVersion" TEXT NOT NULL,
    "triggerConditions" JSONB NOT NULL,
    "status" "PaymentAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "dueMinor" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "acceptedAt" TIMESTAMP(3),
    "triggeredAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "agreementAssetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentAgreement_userId_idx" ON "PaymentAgreement"("userId");

-- CreateIndex
CREATE INDEX "PaymentAgreement_status_createdAt_idx" ON "PaymentAgreement"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentAgreement" ADD CONSTRAINT "PaymentAgreement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAgreement" ADD CONSTRAINT "PaymentAgreement_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
