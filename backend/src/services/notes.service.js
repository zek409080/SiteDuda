import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/errors.js';
import { removeStoredFile } from '../lib/storage.js';

export function serializeNote(note) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    // A tela mostra um clipe com este numero, sem precisar abrir a nota.
    documentCount: note._count?.documents ?? 0,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

const withCount = { _count: { select: { documents: true } } };

/// Mais recentemente mexidas primeiro: o lembrete que a profissional acabou
/// de escrever ou editar e o que ela quer ver ao abrir a tela.
export async function listNotes() {
  const notes = await prisma.note.findMany({
    orderBy: { updatedAt: 'desc' },
    include: withCount,
  });
  return notes.map(serializeNote);
}

export async function createNote(input) {
  const created = await prisma.note.create({
    data: { title: input.title, content: input.content ?? '' },
    include: withCount,
  });
  return serializeNote(created);
}

export async function updateNote(id, input) {
  const current = await prisma.note.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound('Nota não encontrada');

  const updated = await prisma.note.update({
    where: { id },
    data: { title: input.title, content: input.content ?? '' },
    include: withCount,
  });
  return serializeNote(updated);
}

/// Apagar a nota leva os anexos junto (cascade no schema). Os arquivos em
/// disco o banco nao alcanca, entao saem aqui — senao ficariam ocupando
/// espaco para sempre, sem nenhum registro apontando para eles.
export async function deleteNote(id) {
  const current = await prisma.note.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound('Nota não encontrada');

  const documents = await prisma.noteDocument.findMany({
    where: { noteId: id },
    select: { storagePath: true },
  });

  await prisma.note.delete({ where: { id } });

  for (const doc of documents) {
    await removeStoredFile(doc.storagePath);
  }
}
