// Tons suaves para os blocos de notas, independentes dos status da agenda.
export const NOTE_COLORS = [
  { value: 'default', label: 'Padrão', background: '#ffffff', border: '#d8dce0' },
  { value: 'lavender', label: 'Lavanda', background: '#f1e8fc', border: '#c9b3e3' },
  { value: 'pink', label: 'Rosa', background: '#fce9ef', border: '#e7b3c4' },
  { value: 'peach', label: 'Pêssego', background: '#fff0e5', border: '#e6c09d' },
  { value: 'yellow', label: 'Amarelo', background: '#fff8da', border: '#dfcf87' },
  { value: 'green', label: 'Verde', background: '#edf5e6', border: '#bad0a5' },
  { value: 'blue', label: 'Azul', background: '#e9f2fc', border: '#acc9e7' },
];

export const normalizeNoteColor = (value) =>
  NOTE_COLORS.some((color) => color.value === value) ? value : 'default';

export function noteColorStyle(value) {
  const color = NOTE_COLORS.find((item) => item.value === value);
  if (!color || color.value === 'default') return undefined;
  return { '--note-background': color.background, '--note-border': color.border };
}
