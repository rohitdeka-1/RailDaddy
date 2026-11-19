-- Preserve existing profiles. Only accounts created with a password can sign in.
BEGIN;

ALTER TABLE "User"
    -- These profile fields may already exist in databases updated with db push.
    ADD COLUMN IF NOT EXISTS "email" TEXT,
    ADD COLUMN IF NOT EXISTS "preferences" JSONB,
    ADD COLUMN "loginEmail" TEXT,
    ADD COLUMN "passwordHash" TEXT,
    DROP COLUMN "cognitoSub";

CREATE UNIQUE INDEX "User_loginEmail_key" ON "User"("loginEmail");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

COMMIT;
