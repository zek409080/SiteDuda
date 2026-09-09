import { useState } from 'react';
import Modal from './Modal.jsx';
import AppointmentForm from './AppointmentForm.jsx';
import { statusLabel } from '../lib/status.js';
import { formatFull } from '../lib/date.js';
import { api } from '../services/api.js';

/// Cria um novo atendimento ou edita um ja existente.
/// `appointment` (com id) abre em modo edicao, com atalhos rapidos de status.
/// `initial` preenche o formulario de criacao (ex.: cliente ou horario ja escolhidos).
export default function AppointmentModal({ appointment, initial, clients, defaultDuration, onClose, onSaved, onDeleted }) {
  const isEditing = Boolean(appointment?.id);
  const formInitial = appointment ?? initial ?? null;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSubmit(values) {
    setSubmitting(true);
    setError('');
    try {
      const saved = isEditing
        ? await api.updateAppointment(appointment.id, values)
        : await api.createAppointment(values);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function quickStatus(status) {
    setSubmitting(true);
    setError('');
    try {
      const saved = await api.updateAppointment(appointment.id, { status });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setSubmitting(true);
    setError('');
    try {
      await api.deleteAppointment(appointment.id);
      onDeleted(appointment.id);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
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
              <button className="btn btn-danger" type="button" onClick={handleDelete} disabled={submitting}>
                Confirmar exclusão
              </button>
            </>
          ) : (
            <>
              <button className="btn" type="button" onClick={onClose} disabled={submitting}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="submit" form="appointment-form" disabled={submitting}>
                {submitting ? 'Salvando...' : 'Salvar'}
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
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <AppointmentForm
        initial={formInitial}
        clients={clients}
        defaultDuration={defaultDuration}
        onSubmit={handleSubmit}
        onCancel={onClose}
        submitting={submitting}
      />
    </Modal>
  );
}
