import fs from 'node:fs';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/errors.js';
import { absolutePathFor, describeUpload, removeStoredFile } from '../lib/storage.js';

/// O que a tela recebe. `storagePath` fica de fora de proposito: o caminho
/// em disco e assunto do servidor, e o download passa pela rota protegida.
export function serializeDocument(doc, ownerField) {
  return {
    id: doc.id,
    ownerId: doc[ownerField],
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    createdAt: doc.createdAt,
  };
}

/*
 * Paciente e nota guardam anexos do mesmo jeito: mesmo armazenamento, mesma
 * conferencia de dono, mesma limpeza do arquivo em disco. Muda so qual
 * tabela e de quem o arquivo e — entao a regra mora aqui uma vez so, e cada
 * dono ganha a sua instancia abaixo.
 */
function createDocumentService({ documents, owners, ownerField, ownerMissing, documentMissing }) {
  async function ensureOwner(ownerId) {
    const exists = await owners.findUnique({ where: { id: ownerId }, select: { id: true } });
    if (!exists) throw notFound(ownerMissing);
  }

  async function list(ownerId) {
    await ensureOwner(ownerId);
    const rows = await documents.findMany({
      where: { [ownerField]: ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((doc) => serializeDocument(doc, ownerField));
  }

  /// O arquivo chega ao disco antes desta funcao rodar (quem grava e o
  /// multer). Entao qualquer falha daqui para frente precisa apagar o que ja
  /// foi gravado, senao fica um arquivo sem nenhum registro apontando para ele.
  async function create(ownerId, file) {
    try {
      await ensureOwner(ownerId);
      const created = await documents.create({
        data: { [ownerField]: ownerId, ...describeUpload(file) },
      });
      return serializeDocument(created, ownerField);
    } catch (err) {
      await removeStoredFile(file.filename);
      throw err;
    }
  }

  /// Busca exigindo que o documento pertenca AO dono informado na URL. E por
  /// isso que trocar o id na URL nao abre o arquivo de outro: o `where`
  /// combina os dois ids.
  async function owned(ownerId, documentId) {
    const doc = await documents.findFirst({ where: { id: documentId, [ownerField]: ownerId } });
    if (!doc) throw notFound(documentMissing);
    return doc;
  }

  /// Documento + caminho em disco conferido, pronto para ser enviado.
  async function open(ownerId, documentId) {
    const doc = await owned(ownerId, documentId);
    const fullPath = absolutePathFor(doc.storagePath);
    if (!fullPath || !fs.existsSync(fullPath)) {
      throw notFound('O arquivo deste documento não está mais disponível');
    }
    return { doc, fullPath };
  }

  /// Apaga o registro e o arquivo. O registro sai primeiro: se a remocao do
  /// arquivo falhar, sobra um arquivo sem dono (que a limpeza resolve) em vez
  /// de uma linha apontando para um arquivo que ja nao existe.
  async function remove(ownerId, documentId) {
    const doc = await owned(ownerId, documentId);
    await documents.delete({ where: { id: doc.id } });
    await removeStoredFile(doc.storagePath);
  }

  return { list, create, open, remove };
}

export const clientDocuments = createDocumentService({
  documents: prisma.clientDocument,
  owners: prisma.client,
  ownerField: 'clientId',
  ownerMissing: 'Paciente não encontrado',
  documentMissing: 'Documento não encontrado',
});

export const noteDocuments = createDocumentService({
  documents: prisma.noteDocument,
  owners: prisma.note,
  ownerField: 'noteId',
  ownerMissing: 'Nota não encontrada',
  documentMissing: 'Documento não encontrado',
});
