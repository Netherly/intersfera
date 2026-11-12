-- Почта адресата хранится в справочнике и правится отдельно от письма.
ALTER TABLE "addressees" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';
