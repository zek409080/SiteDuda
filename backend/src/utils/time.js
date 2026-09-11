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

/* ---------------------------------------------------------------------
 * Aritmetica de datas para a recorrencia.
 *
 * Tudo trabalha em cima da string "AAAA-MM-DD" e do calendario UTC. Isso
 * e de proposito: usar o fuso local aqui faria uma consulta das 17:10
 * "andar" de dia quando o servidor estivesse em outro fuso que o da
 * profissional. Como a data e o horario sao guardados separados (DATE e
 * "HH:MM" em texto), nada aqui converte horario nenhum.
 * ------------------------------------------------------------------- */

const parts = (dateString) => dateString.split('-').map(Number);

export function addDaysToDate(dateString, days) {
  const [y, m, d] = parts(dateString);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/// Dia da semana: 0 = domingo ... 6 = sabado.
export function weekdayOfDate(dateString) {
  const [y, m, d] = parts(dateString);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/// Domingo da semana da data informada.
export function startOfWeekDate(dateString) {
  return addDaysToDate(dateString, -weekdayOfDate(dateString));
}

/*
 * Soma meses preservando o dia de origem.
 *
 * Fevereiro nao tem dia 31, entao uma consulta todo dia 31 precisa de uma
 * regra. A escolhida: encosta no ultimo dia do mes quando o dia nao existe,
 * e volta ao dia original no mes seguinte que tiver. Por isso a conta sempre
 * parte da data de origem (`anchor`) e nao da ocorrencia anterior — somar
 * de um em um faria 31/01 virar 28/02 e depois 28/03, arrastando a serie
 * inteira para o dia errado.
 *
 *   31/01 -> 28/02 -> 31/03 -> 30/04 -> 31/05
 */
export function addMonthsToDate(anchorDate, months) {
  const [y, m, d] = parts(anchorDate);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}
