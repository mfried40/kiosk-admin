-- Add missing createdAt column to AlertRule (was in schema.prisma but missing from initial migration)
ALTER TABLE "AlertRule" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- NOTE: Device.passwordEnc and other columns have already been updated in the DB via
-- `prisma db push` to match schema.prisma. Those changes are reflected in the DB but
-- not in this migration history file. The actual current DB schema matches schema.prisma.
