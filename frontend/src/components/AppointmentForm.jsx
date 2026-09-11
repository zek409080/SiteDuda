import { useEffect, useState } from 'react';
import { STATUS, STATUS_LIST } from '../lib/status.js';
import { addMonths, minutesToTime, timeToMinutes, todayKey, WEEKDAYS_SHORT } from '../lib/date.js';
import './appointment-form.css';

const TYPES = ['Consulta', 'Primeira consulta', 'Retorno', 'Avaliação'];

const FREQUENCIES = [
  { value: 'WEEKLY', label: 'Semanalmente' },
  { value: 'BIWEEKLY', label: 'A cada 2 semanas' },
  { value: 'MONTHLY', label: 'Mensalmente' },
  { value: 'BIMONTHLY', label: 'A cada 2 meses' },
  { value: 'CUSTOM', label: 'Personalizado' },
];

const END_OF_DAY = 24 * 60 - 1; // 23:59

/// Fim sugerido a partir do início. Um atendimento não atravessa a meia-noite
/// nesta agenda (a data é uma coluna só), então a sugestão encosta em 23:59;
/// sem isso um início às 23:30 geraria "24:20", que o campo de hora recusa e
/// deixaria a hora de término em branco.
function suggestEnd(startTime, duration) {
  if (!startTime) return '';
  const start = timeToMinutes(startTime);
  if (start >= END_OF_DAY) return '';
  return minutesToTime(Math.min(start + duration, END_OF_DAY));
}

/// Frequências contadas em semanas — só elas mostram a escolha dos dias.
const isWeekBased = (frequency, unit) =>
  frequency === 'WEEKLY' || frequency === 'BIWEEKLY' || (frequency === 'CUSTOM' && unit === 'WEEK');

/// Formulario usado tanto para criar quanto para editar um atendimento.
/// A recorrencia so aparece na criacao: editar uma ocorrencia solta nao deve
/// oferecer a criacao de uma serie nova por cima da que ja existe.
export default function AppointmentForm({ initial, clients, defaultDuration, isEditing, onSubmit }) {
  const [form, setForm] = useState(() => {
    const startTime = initial?.startTime ?? '';
    return {
      clientId: initial?.clientId ?? '',
      date: initial?.date ?? todayKey(),
      startTime,
      endTime: initial?.endTime ?? suggestEnd(startTime, defaultDuration),
      type: initial?.type ?? 'Consulta',
      status: initial?.status ?? 'AGENDADO',
      notes: initial?.notes ?? '',
    };
  });

  // Depois que a profissional digita a hora de término, o sistema para de
  // recalculá-la sozinho — senão apagaria o que ela acabou de escolher.
  const [endEdited, setEndEdited] = useState(Boolean(initial?.endTime));

  const [repeat, setRepeat] = useState(false);
  const [recurrence, setRecurrence] = useState(() => ({
    frequency: 'MONTHLY',
    interval: 3,
    unit: 'WEEK',
    endMode: 'until', // until | count
    until: '',
    count: 10,
    weekdays: [],
  }));

  useEffect(() => {
    // Um unico paciente cadastrado ja vem escolhido.
    if (!form.clientId && clients.length === 1) {
      setForm((prev) => ({ ...prev, clientId: clients[0].id }));
    }
  }, [clients, form.clientId]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const setRec = (key) => (event) =>
    setRecurrence((prev) => ({ ...prev, [key]: event.target.value }));

  function handleStartTime(event) {
    const startTime = event.target.value;
    setForm((prev) => ({
      ...prev,
      startTime,
      endTime: endEdited || !startTime ? prev.endTime : suggestEnd(startTime, defaultDuration),
    }));
  }

  function toggleRepeat(next) {
    setRepeat(next);
    // "Repetir até" começa três meses à frente: um padrão útil que evita a
    // profissional ter que escolher uma data só para o formulário aceitar.
    if (next && !recurrence.until) {
      setRecurrence((prev) => ({ ...prev, until: addMonths(form.date || todayKey(), 3) }));
    }
  }

  function toggleWeekday(index) {
    setRecurrence((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(index)
        ? prev.weekdays.filter((d) => d !== index)
        : [...prev.weekdays, index],
    }));
  }

  const timesInvalid =
    form.startTime && form.endTime && timeToMinutes(form.endTime) <= timeToMinutes(form.startTime);

  function handleSubmit(event) {
    event.preventDefault();
    if (timesInvalid) return;

    const payload = {
      clientId: form.clientId,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      type: form.type,
      status: form.status,
      notes: form.notes,
    };

    if (repeat && !isEditing) {
      const weekBased = isWeekBased(recurrence.frequency, recurrence.unit);
      payload.recurrence = {
        frequency: recurrence.frequency,
        ...(recurrence.frequency === 'CUSTOM'
          ? { interval: Number(recurrence.interval), unit: recurrence.unit }
          : {}),
        ...(recurrence.endMode === 'until'
          ? { until: recurrence.until }
          : { count: Number(recurrence.count) }),
        ...(weekBased && recurrence.weekdays.length ? { weekdays: recurrence.weekdays } : {}),
      };
    }

    onSubmit(payload);
  }

  const weekBased = isWeekBased(recurrence.frequency, recurrence.unit);

  return (
    <form id="appointment-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="ap-client">Paciente</label>
        <select id="ap-client" className="select" value={form.clientId} onChange={set('clientId')} required>
          <option value="">Selecionar paciente</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        {clients.length === 0 && (
          <span className="hint">Nenhum paciente cadastrado ainda. Cadastre um em Pacientes.</span>
        )}
      </div>

      <div className="field">
        <label htmlFor="ap-date">Data</label>
        <input
          id="ap-date"
          className="input"
          type="date"
          value={form.date}
          onChange={set('date')}
          required
        />
      </div>

      {/* step=60 libera qualquer minuto: 17:01, 17:23, 17:47... Sem isso o
          navegador prende a escolha nos degraus de 5 em 5 minutos. */}
      <div className="row">
        <div className="field">
          <label htmlFor="ap-start">Hora início</label>
          <input
            id="ap-start"
            className="input"
            type="time"
            step="60"
            value={form.startTime}
            onChange={handleStartTime}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="ap-end">Hora fim</label>
          <input
            id="ap-end"
            className="input"
            type="time"
            step="60"
            value={form.endTime}
            onChange={(event) => {
              setEndEdited(true);
              setForm((prev) => ({ ...prev, endTime: event.target.value }));
            }}
            required
          />
        </div>
      </div>

      {timesInvalid && (
        <p className="error-text time-error">
          A hora de término deve ser posterior à hora de início.
        </p>
      )}

      <div className="row">
        <div className="field">
          <label htmlFor="ap-type">Tipo</label>
          <select id="ap-type" className="select" value={form.type} onChange={set('type')}>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ap-status">Status</label>
          <select id="ap-status" className="select" value={form.status} onChange={set('status')}>
            {STATUS_LIST.map((value) => (
              <option key={value} value={value}>
                {STATUS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!isEditing && (
        <div className="repeat-block">
          <label className="switch-row" htmlFor="ap-repeat">
            <span>Repetir agendamento?</span>
            <input
              id="ap-repeat"
              type="checkbox"
              className="switch"
              checked={repeat}
              onChange={(event) => toggleRepeat(event.target.checked)}
            />
          </label>

          {/* Os campos da recorrência só existem quando ela está ligada,
              para o formulário do atendimento avulso continuar curto. */}
          {repeat && (
            <div className="repeat-fields">
              <div className="field">
                <label htmlFor="ap-frequency">Frequência</label>
                <select
                  id="ap-frequency"
                  className="select"
                  value={recurrence.frequency}
                  onChange={setRec('frequency')}
                >
                  {FREQUENCIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              {recurrence.frequency === 'CUSTOM' && (
                <div className="row">
                  <div className="field">
                    <label htmlFor="ap-interval">Repetir a cada</label>
                    <input
                      id="ap-interval"
                      className="input"
                      type="number"
                      min="1"
                      max="12"
                      value={recurrence.interval}
                      onChange={setRec('interval')}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ap-unit">Unidade</label>
                    <select id="ap-unit" className="select" value={recurrence.unit} onChange={setRec('unit')}>
                      <option value="WEEK">semanas</option>
                      <option value="MONTH">meses</option>
                    </select>
                  </div>
                </div>
              )}

              {weekBased && (
                <div className="field">
                  <span className="group-label">Dias da semana</span>
                  <span className="hint">
                    Deixe em branco para repetir sempre no mesmo dia da semana da primeira data.
                  </span>
                  <div className="weekday-group">
                    {WEEKDAYS_SHORT.map((label, index) => (
                      <label key={label} className="weekday">
                        <input
                          type="checkbox"
                          checked={recurrence.weekdays.includes(index)}
                          onChange={() => toggleWeekday(index)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="field">
                <span className="group-label">Terminar</span>
                <div className="end-mode">
                  <label className="choice">
                    <input
                      type="radio"
                      name="ap-end-mode"
                      checked={recurrence.endMode === 'until'}
                      onChange={() => setRecurrence((prev) => ({ ...prev, endMode: 'until' }))}
                    />
                    Repetir até
                  </label>
                  <input
                    className="input end-mode-value"
                    type="date"
                    value={recurrence.until}
                    onChange={setRec('until')}
                    disabled={recurrence.endMode !== 'until'}
                    required={recurrence.endMode === 'until'}
                    aria-label="Repetir até a data"
                  />
                </div>
                <div className="end-mode">
                  <label className="choice">
                    <input
                      type="radio"
                      name="ap-end-mode"
                      checked={recurrence.endMode === 'count'}
                      onChange={() => setRecurrence((prev) => ({ ...prev, endMode: 'count' }))}
                    />
                    Quantidade
                  </label>
                  <input
                    className="input end-mode-value"
                    type="number"
                    min="1"
                    max="120"
                    value={recurrence.count}
                    onChange={setRec('count')}
                    disabled={recurrence.endMode !== 'count'}
                    aria-label="Quantidade de ocorrências"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="field">
        <label htmlFor="ap-notes">Observação</label>
        <textarea
          id="ap-notes"
          className="textarea"
          value={form.notes ?? ''}
          onChange={set('notes')}
          placeholder="Anotações desta sessão (privadas)"
        />
      </div>

      {/* Salvar/Cancelar/Excluir ficam no rodapé do modal (AppointmentModal),
          para nao duplicar botoes entre o formulario e o modal. */}
    </form>
  );
}
