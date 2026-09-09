import { useState } from 'react';
import Modal from './Modal.jsx';
import ClientForm from './ClientForm.jsx';
import { api } from '../services/api.js';

export default function ClientModal({ client, onClose, onSaved }) {
  const isEditing = Boolean(client);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(values) {
    setSubmitting(true);
    setError('');
    try {
      const saved = isEditing ? await api.updateClient(client.id, values) : await api.createClient(values);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={isEditing ? 'Editar cliente' : 'Novo cliente'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit" form="client-form" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Salvar cliente'}
          </button>
        </>
      }
    >
      {error && <p className="error-text">{error}</p>}
      <ClientForm initial={client} onSubmit={handleSubmit} onCancel={onClose} submitting={submitting} />
    </Modal>
  );
}
