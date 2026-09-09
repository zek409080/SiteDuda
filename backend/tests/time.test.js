import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  timeToMinutes,
  minutesToTime,
  dateOnlyToUtc,
  utcToDateOnly,
  overlaps,
} from '../src/utils/time.js';

test('timeToMinutes converte HH:MM em minutos desde a meia-noite', () => {
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('08:30'), 510);
  assert.equal(timeToMinutes('23:59'), 1439);
});

test('minutesToTime converte minutos de volta para HH:MM', () => {
  assert.equal(minutesToTime(0), '00:00');
  assert.equal(minutesToTime(510), '08:30');
  assert.equal(minutesToTime(1439), '23:59');
});

test('dateOnlyToUtc e utcToDateOnly sao inversas, sem deslocamento de fuso', () => {
  const date = dateOnlyToUtc('2026-09-15');
  assert.equal(utcToDateOnly(date), '2026-09-15');
});

test('overlaps detecta sobreposicao de intervalos', () => {
  // 14:00-14:50 contra 14:20-15:10 -> sobrepoe
  assert.equal(overlaps(840, 890, 860, 910), true);
  // 14:00-14:50 contra 14:50-15:40 -> encostam mas nao sobrepoem
  assert.equal(overlaps(840, 890, 890, 940), false);
  // 14:00-14:50 contra 15:00-15:50 -> livre
  assert.equal(overlaps(840, 890, 900, 950), false);
});
