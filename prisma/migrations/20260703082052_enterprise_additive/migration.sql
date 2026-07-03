-- AlterEnum
ALTER TYPE "LicenseKind" ADD VALUE 'CREDIT_POOL';

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "orgLicenseId" TEXT;

-- AlterTable
ALTER TABLE "ProjectInstance" ADD COLUMN     "programEnrollmentId" TEXT;

-- CreateTable
CREATE TABLE "LicenseConsumption" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" "ProgramItemType" NOT NULL,
    "courseId" TEXT,
    "projectId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "enrollmentId" TEXT,
    "projectInstanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LicenseConsumption_licenseId_createdAt_idx" ON "LicenseConsumption"("licenseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseConsumption_licenseId_userId_courseId_key" ON "LicenseConsumption"("licenseId", "userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseConsumption_licenseId_userId_projectId_key" ON "LicenseConsumption"("licenseId", "userId", "projectId");

-- CreateIndex
CREATE INDEX "Enrollment_orgLicenseId_idx" ON "Enrollment"("orgLicenseId");

-- CreateIndex
CREATE INDEX "ProjectInstance_programEnrollmentId_idx" ON "ProjectInstance"("programEnrollmentId");

-- AddForeignKey
ALTER TABLE "LicenseConsumption" ADD CONSTRAINT "LicenseConsumption_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "OrgLicense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseConsumption" ADD CONSTRAINT "LicenseConsumption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseConsumption" ADD CONSTRAINT "LicenseConsumption_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseConsumption" ADD CONSTRAINT "LicenseConsumption_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseConsumption" ADD CONSTRAINT "LicenseConsumption_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseConsumption" ADD CONSTRAINT "LicenseConsumption_projectInstanceId_fkey" FOREIGN KEY ("projectInstanceId") REFERENCES "ProjectInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_orgLicenseId_fkey" FOREIGN KEY ("orgLicenseId") REFERENCES "OrgLicense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInstance" ADD CONSTRAINT "ProjectInstance_programEnrollmentId_fkey" FOREIGN KEY ("programEnrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══ Hand-written integrity layer (additive, enterprise) ═══

-- Exactly one redemption target per consumption row
ALTER TABLE "LicenseConsumption" ADD CONSTRAINT "license_consumption_exactly_one_target"
  CHECK (num_nonnulls("courseId","projectId") = 1);

-- Consumption amounts are positive money
ALTER TABLE "LicenseConsumption" ADD CONSTRAINT "license_consumption_amount_positive"
  CHECK ("amountMinor" > 0);

-- Same email cannot be invited twice to one license while unclaimed
CREATE UNIQUE INDEX "license_seat_invited_email_key"
  ON "LicenseSeat" ("licenseId", lower("inviteEmail"))
  WHERE "userId" IS NULL AND "inviteEmail" IS NOT NULL;
