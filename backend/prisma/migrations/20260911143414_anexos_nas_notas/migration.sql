-- CreateTable
CREATE TABLE "note_documents" (
    "id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "storage_name" VARCHAR(120) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "note_documents_storage_name_key" ON "note_documents"("storage_name");

-- CreateIndex
CREATE INDEX "note_documents_note_id_idx" ON "note_documents"("note_id");

-- AddForeignKey
ALTER TABLE "note_documents" ADD CONSTRAINT "note_documents_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
