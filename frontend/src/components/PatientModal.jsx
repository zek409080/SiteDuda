import { useState } from 'react';
import Modal from './Modal.jsx';
import PatientForm from './PatientForm.jsx';
import { api } from '../services/api.js';

export default function PatientModal({ patient, onClose, onSaved }) {
  const isEditing = Boolean(patient);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(values) {
    setSubmitting(true);
    setError('');
    try {
      const saved = isEditing
        ? await api.updateClient(patient.id, values)
        : await api.createClient(values);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <Modal
      wide
      title={isEditing ? 'Editar paciente' : 'Novo paciente'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit" form="patient-form" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Salvar paciente'}
          </button>
        </>
      }
    >
      {error && <p className="error-text">{error}</p>}
      <PatientForm initial={patient} onSubmit={handleSubmit} />
    </Modal>
  );
}
