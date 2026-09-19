import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayStatus, STATUS_LIST, statusLabel } from '../src/lib/status.js';

test('oferece apenas os status atuais na interface', () => {
  assert.deepEqual(STATUS_LIST, ['AGENDADO', 'REALIZADO', 'CANCELADO', 'FALTOU']);
});

test('apresenta consultas confirmadas antigas como agendadas', () => {
  assert.equal(displayStatus('CONFIRMADO'), 'AGENDADO');
  assert.equal(statusLabel('CONFIRMADO'), 'Agendado');
});
