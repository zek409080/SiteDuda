import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../lib/auth.jsx';
import PatientModal from '../components/PatientModal.jsx';
import AppointmentModal from '../components/AppointmentModal.jsx';
import DocumentsPanel from '../components/DocumentsPanel.jsx';
import { formatFull } from '../lib/date.js';
import { statusLabel } from '../lib/status.js';
import { deletedMessage, savedMessage } from '../lib/appointmentFeedback.js';
import './patient-detail.css';

const TABS = [
  { key: 'info', label: 'Informações' },
  { key: 'responsibles', label: 'Responsáveis' },
  { key: 'health', label: 'Saúde' },
  { key: 'documents', label: 'Documentos' },
  { key: 'appointments', label: 'Atendimentos' },
];

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useAuth();

  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [tab, setTab] = useState('info');
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [appointmentModal, setAppointmentModal] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [patients, setPatients] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    setErrorMsg('');
    Promise.all([api.getClient(id), api.clientAppointments(id)])
      .then(([patientData, historyData]) => {
        setPatient(patientData);
        setHistory(historyData);
      })
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.listClients().then(setPatients).catch(() => setPatients([]));
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(''), 9000);
    return () => clearTimeout(timer);
  }, [feedback]);

  async function handleDelete() {
    try {
      await api.deleteClient(id);
      navigate('/pacientes');
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;
  if (errorMsg && !patient) return <p className="error-text">{errorMsg}</p>;
  if (!patient) return null;

  const responsibles = patient.responsibles ?? [];
  const allergies = patient.allergies ?? [];
  const medications = patient.medications ?? [];

  return (
    <div className="patient-detail">
      <Link to="/pacientes" className="back-link">
        ← Pacientes
      </Link>

      <div className="card patient-card">
        <div className="spread">
          <h1>{patient.name}</h1>
          <div className="patient-actions">
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

        {errorMsg && <p className="error-text">{errorMsg}</p>}

        {/* No celular esta faixa rola na horizontal em vez de quebrar. O
            degrade na borda direita avisa que ha mais abas fora da tela. */}
        <div className="patient-tabs-wrap">
          <nav className="patient-tabs" role="tablist">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                className={`patient-tab ${tab === item.key ? 'active' : ''}`}
                onClick={(event) => {
                setTab(item.key);
                // No celular a aba clicada pode estar meio fora da faixa;
                // `nearest` rola so a faixa, sem mexer na rolagem da pagina.
                event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
              }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {tab === 'info' && (
        <section className="card tab-panel">
          <dl className="patient-info">
            <div>
              <dt>Telefone</dt>
              <dd>{patient.phone}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{patient.email || '—'}</dd>
            </div>
            <div>
              <dt>Data de nascimento</dt>
              <dd>{patient.birthDate ? formatFull(patient.birthDate) : '—'}</dd>
            </div>
            <div className="info-wide">
              <dt>Endereço</dt>
              <dd>{patient.address || '—'}</dd>
            </div>
          </dl>

          <div className="patient-notes">
            <span className="small muted">Observações gerais</span>
            <p>{patient.notes || '—'}</p>
          </div>
        </section>
      )}

      {tab === 'responsibles' && (
        <section className="card tab-panel">
          {responsibles.length === 0 ? (
            <p className="empty">Nenhum responsável cadastrado.</p>
          ) : (
            <ul className="info-cards">
              {responsibles.map((item) => (
                <li key={item.id} className="info-card">
                  <div className="info-card-head">
                    <span className="info-card-title">{item.name}</span>
                    <span className="badge badge-neutral">{item.relation}</span>
                  </div>
                  <dl className="patient-info">
                    <div>
                      <dt>Telefone</dt>
                      <dd>{item.phone || '—'}</dd>
                    </div>
                    <div>
                      <dt>E-mail</dt>
                      <dd>{item.email || '—'}</dd>
                    </div>
                  </dl>
                  {item.notes && <p className="small info-card-note">{item.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'health' && (
        <section className="card tab-panel">
          <h2 className="panel-title">Alergias</h2>
          {!patient.hasAllergies ? (
            <p className="muted small">Nenhuma alergia conhecida.</p>
          ) : allergies.length === 0 ? (
            <p className="muted small">Marcado como "possui alergias", mas nenhuma foi detalhada.</p>
          ) : (
            <ul className="info-cards">
              {allergies.map((item) => (
                <li key={item.id} className="info-card">
                  <span className="info-card-title">{item.name}</span>
                  {item.notes && <p className="small muted">{item.notes}</p>}
                </li>
              ))}
            </ul>
          )}

          <h2 className="panel-title panel-title-spaced">Medicamentos em uso</h2>
          {medications.length === 0 ? (
            <p className="muted small">Nenhum medicamento registrado.</p>
          ) : (
            <ul className="info-cards">
              {medications.map((item) => (
                <li key={item.id} className="info-card">
                  <span className="info-card-title">{item.name}</span>
                  <dl className="patient-info">
                    <div>
                      <dt>Dosagem</dt>
                      <dd>{item.dosage || '—'}</dd>
                    </div>
                    <div>
                      <dt>Frequência</dt>
                      <dd>{item.frequency || '—'}</dd>
                    </div>
                  </dl>
                  {item.notes && <p className="small muted">{item.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'documents' && (
        <section className="card tab-panel">
          <DocumentsPanel owner="clients" ownerId={patient.id} />
        </section>
      )}

      {tab === 'appointments' && (
        <section className="tab-panel-plain">
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

          {feedback && <p className="success-text">{feedback}</p>}

          {history.length === 0 ? (
            <p className="empty">Nenhum atendimento registrado ainda.</p>
          ) : (
            <ul className="history-list">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    className="history-row card"
                    type="button"
                    onClick={() => setAppointmentModal(item)}
                  >
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
      )}

      {editOpen && (
        <PatientModal
          patient={patient}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setPatient(updated);
            setEditOpen(false);
          }}
        />
      )}

      {appointmentModal && (
        <AppointmentModal
          appointment={appointmentModal.new ? undefined : appointmentModal}
          initial={appointmentModal.new ? { clientId: patient.id } : undefined}
          clients={patients.length ? patients : [{ id: patient.id, name: patient.name }]}
          defaultDuration={settings?.defaultDuration ?? 50}
          onClose={() => setAppointmentModal(null)}
          onSaved={(saved) => {
            setFeedback(savedMessage(saved, !appointmentModal.new));
            setAppointmentModal(null);
            load();
          }}
          onDeleted={(id, result) => {
            setFeedback(deletedMessage(result));
            setAppointmentModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
