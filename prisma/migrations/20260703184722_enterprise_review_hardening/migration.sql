-- Review hardening (PR #31 bot review), additive-only.

-- 1. LicenseConsumption.courseId/projectId: ON DELETE SET NULL would zero the
--    row's only target and trip license_consumption_exactly_one_target with a
--    confusing CHECK error. RESTRICT fails such a delete cleanly instead
--    (consumption rows are financial records and must outlive nothing).
ALTER TABLE "LicenseConsumption" DROP CONSTRAINT "LicenseConsumption_courseId_fkey";
ALTER TABLE "LicenseConsumption" ADD CONSTRAINT "LicenseConsumption_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LicenseConsumption" DROP CONSTRAINT "LicenseConsumption_projectId_fkey";
ALTER TABLE "LicenseConsumption" ADD CONSTRAINT "LicenseConsumption_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Exactly one PROGRAM credential per program enrollment: concurrent
--    rollups (course completion + project finalization) can both pass the
--    application-level findFirst; the loser must hit this unique instead of
--    inserting a duplicate. Partial index — Prisma can't express the WHERE,
--    same precedent as the LicenseSeat invite-email unique.
CREATE UNIQUE INDEX "Credential_programEnrollmentId_program_key"
  ON "Credential"("programEnrollmentId")
  WHERE "kind" = 'PROGRAM';
