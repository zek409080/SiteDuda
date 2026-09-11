/* Mensagens mostradas depois de gravar ou cancelar um atendimento.
   Ficam aqui porque a Agenda e a pagina do paciente usam as duas. */

import { formatFull } from './date.js';

const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

/// Lista curta das ocorrencias que nao couberam por conflito de horario.
function skippedNote(skipped = []) {
  if (skipped.length === 0) return '';
  const datas = skipped
    .slice(0, 3)
    .map((item) => `${formatFull(item.date)} às ${item.startTime}`)
    .join(', ');
  const resto = skipped.length > 3 ? ` (e mais ${skipped.length - 3})` : '';
  return ` Não foi possível criar ${plural(skipped.length, 'atendimento', 'atendimentos')} porque já existe outro agendamento no horário: ${datas}${resto}.`;
}

export function savedMessage(saved, wasEditing) {
  if (saved?.recurrence) {
    const { createdCount, skipped } = saved.recurrence;
    return (
      `Agendamento recorrente criado com sucesso. ${plural(createdCount, 'atendimento foi adicionado', 'atendimentos foram adicionados')} à agenda.` +
      skippedNote(skipped)
    );
  }

  if (saved?.series) {
    const { updatedCount, skipped } = saved.series;
    return (
      `Alteração aplicada a ${plural(updatedCount, 'atendimento', 'atendimentos')} da série.` +
      skippedNote(skipped)
    );
  }

  return wasEditing ? 'Agendamento atualizado com sucesso.' : 'Agendamento criado com sucesso.';
}

export function deletedMessage(result) {
  const total = result?.deletedCount ?? 1;
  return total > 1
    ? `${plural(total, 'atendimento cancelado', 'atendimentos cancelados')}.`
    : 'Agendamento cancelado.';
}
