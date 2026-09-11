import { useState } from 'react';
import Modal from './Modal.jsx';
import AppointmentForm from './AppointmentForm.jsx';
import { statusLabel } from '../lib/status.js';
import { formatFull } from '../lib/date.js';
import { api } from '../services/api.js';

const EDIT_SCOPES = [
  { value: 'one', label: 'Somente este atendimento' },
  { value: 'following', label: 'Este e os próximos atendimentos' },
  { value: 'series', label: 'Toda a série' },
];

const DELETE_SCOPES = [
  { value: 'one', label: 'Cancelar apenas este atendimento' },
  { value: 'following', label: 'Cancelar este e os próximos atendimentos' },
  { value: 'series', label: 'Cancelar toda a série' },
];

/// Cria um novo atendimento ou edita um ja existente.
/// `appointment` (com id) abre em modo edicao, com atalhos rapidos de status.
/// `initial` preenche o formulario de criacao (ex.: paciente ou horario ja escolhidos).
export default function AppointmentModal({ appointment, initial, clients, defaultDuration, onClose, onSaved, onDeleted }) {
  const isEditing = Boolean(appointment?.id);
  const formInitial = appointment ?? initial ?? null;
  const isRecurring = Boolean(appointment?.recurrenceGroupId);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Quando o atendimento faz parte de uma serie, o alcance e perguntado
  // antes de gravar ou apagar — nunca decidido por conta propria.
  const [pendingSave, setPendingSave] = useState(null);

  async function save(values, scope) {
    setSubmitting(true);
    setError('');
    try {
      const saved = isEditing
        ? await api.updateAppointment(appointment.id, scope ? { ...values, scope } : values)
        : await api.createAppointment(values);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setPendingSave(null);
      setSubmitting(false);
    }
  }

  function handleSubmit(values) {
    if (isEditing && isRecurring) {
      setPendingSave(values);
      return;
    }
    save(values);
  }

  async function quickStatus(status) {
    setSubmitting(true);
    setError('');
    try {
      onSaved(await api.updateAppointment(appointment.id, { status }));
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  async function remove(scope) {
    setSubmitting(true);
    setError('');
    try {
      const result = await api.deleteAppointment(appointment.id, scope);
      onDeleted(appointment.id, result);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (pendingSave) {
    return (
      <ScopeChoice
        title="Alterar atendimento recorrente"
        question="Você deseja alterar somente este atendimento ou toda a série?"
        options={EDIT_SCOPES}
        confirmLabel="Salvar alteração"
        submitting={submitting}
        onCancel={() => setPendingSave(null)}
        onConfirm={(scope) => save(pendingSave, scope)}
      />
    );
  }

  if (confirmDelete && isRecurring) {
    return (
      <ScopeChoice
        title="Cancelar atendimento recorrente"
        question="O que deseja fazer?"
        options={DELETE_SCOPES}
        confirmLabel="Confirmar"
        danger
        submitting={submitting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    );
  }

  return (
    <Modal
      title={isEditing ? 'Detalhes do atendimento' : 'Novo agendamento'}
      onClose={onClose}
      footer={
        <>
          {isEditing && !confirmDelete && (
            <button className="btn btn-danger" type="button" onClick={() => setConfirmDelete(true)} disabled={submitting}>
              Excluir
            </button>
          )}
          {confirmDelete ? (
            <>
              <span className="small muted" style={{ marginRight: 'auto', alignSelf: 'center' }}>
                Excluir este agendamento?
              </span>
              <button className="btn" type="button" onClick={() => setConfirmDelete(false)}>
                Voltar
              </button>
              <button className="btn btn-danger" type="button" onClick={() => remove('one')} disabled={submitting}>
                Confirmar exclusão
              </button>
            </>
          ) : (
            <>
              <button className="btn" type="button" onClick={onClose} disabled={submitting}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="submit" form="appointment-form" disabled={submitting}>
                {submitting ? 'Salvando...' : 'Salvar agendamento'}
              </button>
            </>
          )}
        </>
      }
    >
      {isEditing && (
        <div className="quick-status">
          <span className="small muted">Atalhos rápidos:</span>
          <div className="quick-status-buttons">
            <button className="btn btn-ghost" type="button" disabled={submitting} onClick={() => quickStatus('CONFIRMADO')}>
              Confirmar
            </button>
            <button className="btn btn-ghost" type="button" disabled={submitting} onClick={() => quickStatus('REALIZADO')}>
              Realizado
            </button>
            <button className="btn btn-ghost" type="button" disabled={submitting} onClick={() => quickStatus('FALTOU')}>
              Faltou
            </button>
            <button className="btn btn-ghost" type="button" disabled={submitting} onClick={() => quickStatus('CANCELADO')}>
              Cancelar consulta
            </button>
          </div>
          <div className="spread small muted" style={{ marginTop: 4 }}>
            <span>{formatFull(appointment.date)} · {appointment.startTime}</span>
            <span className={`badge st-${appointment.status}`}>{statusLabel(appointment.status)}</span>
          </div>
          {isRecurring && (
            <p className="small muted" style={{ marginTop: 6 }}>
              🔁 Faz parte de uma série de atendimentos.
            </p>
          )}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <AppointmentForm
        initial={formInitial}
        clients={clients}
        defaultDuration={defaultDuration}
        isEditing={isEditing}
        onSubmit={handleSubmit}
      />
    </Modal>
  );
}

/// Pergunta o alcance da acao dentro de uma serie.
function ScopeChoice({ title, question, options, confirmLabel, danger, submitting, onCancel, onConfirm }) {
  const [scope, setScope] = useState('one');

  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn" type="button" onClick={onCancel} disabled={submitting}>
            Voltar
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            type="button"
            onClick={() => onConfirm(scope)}
            disabled={submitting}
          >
            {submitting ? 'Aplicando...' : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ marginBottom: 12 }}>{question}</p>
      <div className="stack">
        {options.map((option) => (
          <label key={option.value} className="choice">
            <input
              type="radio"
              name="scope"
              checked={scope === option.value}
              onChange={() => setScope(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </Modal>
  );
}
