import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../lib/auth.jsx';
import ClientModal from '../components/ClientModal.jsx';
import AppointmentModal from '../components/AppointmentModal.jsx';
import { formatFull } from '../lib/date.js';
import { statusLabel } from '../lib/status.js';
import './client-detail.css';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useAuth();

  const [client, setClient] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [appointmentModal, setAppointmentModal] = useState(null); // appointment | null
  const [clients, setClients] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    setErrorMsg('');
    Promise.all([api.getClient(id), api.clientAppointments(id)])
      .then(([clientData, historyData]) => {
        setClient(clientData);
        setHistory(historyData);
      })
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.listClients().then(setClients).catch(() => setClients([]));
  }, []);

  async function handleDelete() {
    try {
      await api.deleteClient(id);
      navigate('/clientes');
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  function handleClientSaved(updated) {
    setClient(updated);
    setEditOpen(false);
  }

  function handleAppointmentSaved() {
    setAppointmentModal(null);
    load();
  }

  function handleAppointmentDeleted() {
    setAppointmentModal(null);
    load();
  }

  if (loading) return <p className="muted">Carregando...</p>;
  if (errorMsg && !client) return <p className="error-text">{errorMsg}</p>;
  if (!client) return null;

  return (
    <div className="client-detail">
      <Link to="/clientes" className="back-link">
        ← Clientes
      </Link>

      <div className="card client-card">
        <div className="spread">
          <h1>{client.name}</h1>
          <div className="client-actions">
            <button className="btn" type="button" onClick={() => setEditOpen(true)}>
              Editar
            </button>
            {!confirmDelete ? (
              <button className="btn btn-danger" type="button" onClick={() => setConfirmDelete(true)}>
                Excluir
              </button>
            ) : (
              <>
                <button className="btn" type="button" onClick={() => setConfirmDelete(false)}>
                  Voltar
                </button>
                <button className="btn btn-danger" type="button" onClick={handleDelete}>
                  Confirmar
                </button>
              </>
            )}
          </div>
        </div>

        <dl className="client-info">
          <div>
            <dt>Telefone</dt>
            <dd>{client.phone}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{client.email || '—'}</dd>
          </div>
          <div>
            <dt>Data de nascimento</dt>
            <dd>{client.birthDate ? formatFull(client.birthDate) : '—'}</dd>
          </div>
        </dl>

        {client.notes && (
          <div className="client-notes">
            <span className="small muted">Observações gerais</span>
            <p>{client.notes}</p>
          </div>
        )}
      </div>

      <section>
        <div className="spread">
          <h2>Histórico</h2>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setAppointmentModal({ new: true })}
          >
            + Novo agendamento
          </button>
        </div>

        {history.length === 0 ? (
          <p className="empty">Nenhum atendimento registrado ainda.</p>
        ) : (
          <ul className="history-list">
            {history.map((item) => (
              <li key={item.id}>
                <button className="history-row card" type="button" onClick={() => setAppointmentModal(item)}>
                  <div>
                    <span className="history-date">{formatFull(item.date)}</span>
                    <span className="small muted"> às {item.startTime}</span>
                  </div>
                  <div className="spread">
                    <span className="small">{item.type}</span>
                    <span className={`badge st-${item.status}`}>{statusLabel(item.status)}</span>
                  </div>
                  {item.notes && <p className="history-note small muted">{item.notes}</p>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editOpen && <ClientModal client={client} onClose={() => setEditOpen(false)} onSaved={handleClientSaved} />}

      {appointmentModal && (
        <AppointmentModal
          appointment={appointmentModal.new ? undefined : appointmentModal}
          initial={appointmentModal.new ? { clientId: client.id } : undefined}
          clients={clients.length ? clients : [{ id: client.id, name: client.name }]}
          defaultDuration={settings?.defaultDuration ?? 50}
          onClose={() => setAppointmentModal(null)}
          onSaved={handleAppointmentSaved}
          onDeleted={handleAppointmentDeleted}
        />
      )}
    </div>
  );
}
