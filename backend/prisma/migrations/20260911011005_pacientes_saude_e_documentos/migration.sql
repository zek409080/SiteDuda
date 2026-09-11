-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "address" VARCHAR(240),
ADD COLUMN     "has_allergies" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "client_responsibles" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "relation" VARCHAR(60) NOT NULL,
    "phone" VARCHAR(30),
    "email" VARCHAR(160),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_responsibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_allergies" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_medications" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "dosage" VARCHAR(60),
    "frequency" VARCHAR(80),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_documents" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "storage_name" VARCHAR(120) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_responsibles_client_id_idx" ON "client_responsibles"("client_id");

-- CreateIndex
CREATE INDEX "client_allergies_client_id_idx" ON "client_allergies"("client_id");

-- CreateIndex
CREATE INDEX "client_medications_client_id_idx" ON "client_medications"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_documents_storage_name_key" ON "client_documents"("storage_name");

-- CreateIndex
CREATE INDEX "client_documents_client_id_idx" ON "client_documents"("client_id");

-- AddForeignKey
ALTER TABLE "client_responsibles" ADD CONSTRAINT "client_responsibles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_allergies" ADD CONSTRAINT "client_allergies_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_medications" ADD CONSTRAINT "client_medications_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
