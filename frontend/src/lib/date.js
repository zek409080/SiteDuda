/* Datas sempre como texto "AAAA-MM-DD", no fuso do proprio computador.
   Assim o dia que aparece na tela e o mesmo que vai para o banco. */

export const WEEKDAYS_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
export const WEEKDAYS_LONG = [
  'domingo', 'segunda-feira', 'terca-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sabado',
];
export const MONTHS = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

export function addDays(key, amount) {
  const d = fromKey(key);
  d.setDate(d.getDate() + amount);
  return toKey(d);
}

export function addMonths(key, amount) {
  const d = fromKey(key);
  d.setDate(1);
  d.setMonth(d.getMonth() + amount);
  return toKey(d);
}

/// Segunda-feira da semana da data informada.
export function startOfWeek(key) {
  const d = fromKey(key);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return toKey(d);
}

export function weekDays(key, count = 7) {
  const start = startOfWeek(key);
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function startOfMonth(key) {
  const d = fromKey(key);
  return toKey(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(key) {
  const d = fromKey(key);
  return toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/// Grade do mes: sempre semanas completas de segunda a domingo.
export function monthGrid(key) {
  const first = startOfWeek(startOfMonth(key));
  const days = [];
  let cursor = first;
  for (let i = 0; i < 42; i += 1) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  const last = endOfMonth(key);
  while (days.length > 35 && days[35] > last) days.length = 35;
  return days;
}

export function formatShort(key) {
  const d = fromKey(key);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatFull(key) {
  const d = fromKey(key);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function formatLong(key) {
  const d = fromKey(key);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function formatMonthYear(key) {
  const d = fromKey(key);
  const name = MONTHS[d.getMonth()];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${d.getFullYear()}`;
}

export function weekLabel(key) {
  const days = weekDays(key);
  return `${formatShort(days[0])} — ${formatShort(days[6])}`;
}

export function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(total) {
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/// Lista de horarios inteiros entre o inicio e o fim do expediente.
export function hourSlots(workStart, workEnd) {
  const start = Math.floor(timeToMinutes(workStart) / 60);
  const end = Math.ceil(timeToMinutes(workEnd) / 60);
  return Array.from({ length: Math.max(1, end - start) }, (_, i) => minutesToTime((start + i) * 60));
}
