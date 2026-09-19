import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patientAppointments } from '../src/lib/patientAppointments.js';

const now = new Date(2026, 8, 19, 14, 30);
const appt = (id, date, startTime, status = 'AGENDADO') => ({ id, date, startTime, status });

test('mostra somente a proxima da serie e preserva anteriores em ordem decrescente', () => {
  const source = [appt('far', '2027-08-23', '14:00'), appt('old', '2026-09-10', '14:00', 'REALIZADO'), appt('next', '2026-09-20', '14:00', 'CONFIRMADO'), appt('today', '2026-09-19', '09:00', 'FALTOU')];
  const copy = structuredClone(source);
  const result = patientAppointments(source, now);
  assert.equal(result.next.id, 'next');
  assert.deepEqual(result.previous.map(a => a.id), ['today', 'old']);
  assert.deepEqual(source, copy);
});

test('ignora status encerrados no futuro e considera o minuto atual', () => {
  const result = patientAppointments([
    appt('cancelled', '2026-09-19', '14:30', 'CANCELADO'),
    appt('done', '2026-09-19', '14:30', 'REALIZADO'),
    appt('absent', '2026-09-19', '14:30', 'FALTOU'),
    appt('next', '2026-09-19', '14:30'),
    appt('later', '2026-09-19', '16:00'),
  ], now);
  assert.equal(result.next.id, 'next');
  assert.deepEqual(result.previous, []);
});

test('mantem todos os status anteriores e trata lista vazia', () => {
  const statuses = ['AGENDADO', 'CONFIRMADO', 'REALIZADO', 'CANCELADO', 'FALTOU'];
  const result = patientAppointments(statuses.map(s => appt(s, '2026-09-18', '14:00', s)), now);
  assert.equal(result.previous.length, 5);
  assert.equal(result.next, null);
  assert.deepEqual(patientAppointments([], now), { next: null, previous: [] });
});

test('avanco do relogio move a consulta anterior e seleciona a seguinte', () => {
  const source = [appt('first', '2026-09-19', '14:30'), appt('second', '2026-09-20', '08:00')];
  const result = patientAppointments(source, new Date(2026, 8, 19, 14, 31));
  assert.equal(result.next.id, 'second');
  assert.deepEqual(result.previous.map(a => a.id), ['first']);
});
