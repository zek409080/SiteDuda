import { useEffect, useState } from 'react';
import { STATUS, STATUS_LIST } from '../lib/status.js';
import { timeToMinutes } from '../lib/date.js';

const TYPES = ['Consulta', 'Primeira consulta', 'Retorno', 'Avaliação'];

/// Formulario usado tanto para criar quanto para editar um atendimento.
export default function AppointmentForm({ initial, clients, defaultDuration, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(() => ({
    clientId: initial?.clientId ?? '',
    date: initial?.date ?? '',
    startTime: initial?.startTime ?? '',
    duration:
      initial?.startTime && initial?.endTime
        ? timeToMinutes(initial.endTime) - timeToMinutes(initial.startTime)
        : defaultDuration,
    type: initial?.type ?? 'Consulta',
    status: initial?.status ?? 'AGENDADO',
    notes: initial?.notes ?? '',
  }));

  useEffect(() => {
    // Um unico cliente cadastrado ja vem escolhido.
    if (!form.clientId && clients.length === 1) {
      setForm((prev) => ({ ...prev, clientId: clients[0].id }));
    }
  }, [clients, form.clientId]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      clientId: form.clientId,
      date: form.date,
      startTime: form.startTime,
      duration: Number(form.duration),
      type: form.type,
      status: form.status,
      notes: form.notes,
    });
  }

  return (
    <form id="appointment-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="ap-client">Cliente</label>
        <select id="ap-client" className="select" value={form.clientId} onChange={set('clientId')} required>
          <option value="">Selecionar cliente</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        {clients.length === 0 && (
          <span className="hint">Nenhum cliente cadastrado ainda. Cadastre um em Clientes.</span>
        )}
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="ap-date">Data</label>
          <input id="ap-date" className="input" type="date" value={form.date} onChange={set('date')} required />
        </div>
        <div className="field">
          <label htmlFor="ap-time">Horário</label>
          <input id="ap-time" className="input" type="time" step="300" value={form.startTime} onChange={set('startTime')} required />
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="ap-duration">Duração</label>
          <select id="ap-duration" className="select" value={form.duration} onChange={set('duration')}>
            {[30, 40, 45, 50, 60, 80, 90, 120].map((value) => (
              <option key={value} value={value}>
                {value} minutos
              </option>
            ))}
          </select>
        </div>
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
