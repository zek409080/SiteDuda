import { toKey } from './date.js';

// Filtra somente a exibicao da ficha; a agenda conserva a serie completa.
export function patientAppointments(appointments, now = new Date()) {
  const boundary = `${toKey(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const key = (item) => `${item.date}T${item.startTime}`;
  const ordered = [...appointments].sort((a, b) => key(a).localeCompare(key(b)));
  const next = ordered.find((item) =>
    key(item) >= boundary && ['AGENDADO', 'CONFIRMADO'].includes(item.status),
  ) ?? null;
  const previous = ordered.filter((item) => key(item) < boundary).reverse();
  return { next, previous };
}
