// Conversao entre "HH:MM", minutos e datas — sem depender de fuso horario.

export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(total) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, total));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/// "2026-09-15" -> Date em UTC meia-noite, que e o formato que a coluna DATE espera.
export function dateOnlyToUtc(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/// Date do Prisma -> "2026-09-15"
export function utcToDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

/// Verifica se dois intervalos [inicio, fim) se sobrepoem.
export function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}
