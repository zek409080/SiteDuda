import { useMemo, useSyncExternalStore } from 'react';
import { normalizeNoteColor } from './noteColors.js';

// Apenas IDs e nomes da paleta. Titulo, conteudo e anexos continuam na API.
const STORAGE_KEY = 'agenda:note-colors:v1';
const CHANGED = 'agenda:cores-das-notas';
let memorySnapshot = '{}';
let memoryOnly = false;

function getSnapshot() {
  if (memoryOnly) return memorySnapshot;
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '{}';
  } catch {
    return memorySnapshot;
  }
}

function parseColors(raw) {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function subscribe(onChange) {
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener(CHANGED, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function useNoteColors() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => '{}');
  return useMemo(() => parseColors(raw), [raw]);
}

export function getNoteColor(noteId) {
  return normalizeNoteColor(parseColors(getSnapshot())[noteId]);
}

export function saveNoteColor(noteId, color) {
  if (!noteId) return;
  const colors = parseColors(getSnapshot());
  const normalized = normalizeNoteColor(color);
  if (normalized === 'default') delete colors[noteId];
  else colors[noteId] = normalized;
  memorySnapshot = JSON.stringify(colors);
  try {
    window.localStorage.setItem(STORAGE_KEY, memorySnapshot);
    memoryOnly = false;
  } catch {
    // Armazenamento bloqueado nao impede salvar a nota; a cor dura nesta aba.
    memoryOnly = true;
  }
  window.dispatchEvent(new Event(CHANGED));
}
