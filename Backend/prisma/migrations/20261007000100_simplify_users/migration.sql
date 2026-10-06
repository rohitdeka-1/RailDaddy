-- Preserve existing users while matching the simplified Prisma model.
ALTER TABLE "users" RENAME TO "User";
ALTER TABLE "User" RENAME COLUMN "cognito_sub" TO "cognitoSub";
ALTER TABLE "User" RENAME COLUMN "display_name" TO "displayName";
ALTER TABLE "User" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "User" RENAME COLUMN "updated_at" TO "updatedAt";
ALTER TABLE "User" ALTER COLUMN "id" TYPE TEXT USING "id"::text;
ALTER TABLE "User" ALTER COLUMN "displayName" TYPE TEXT;
ALTER TABLE "User" ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "User" ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "User" RENAME CONSTRAINT "users_pkey" TO "User_pkey";
ALTER INDEX "users_cognito_sub_key" RENAME TO "User_cognitoSub_key";
