import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import PatientModal from '../components/PatientModal.jsx';
import { formatFull } from '../lib/date.js';
import './patients.css';

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback((term) => {
    setLoading(true);
    setErrorMsg('');
    api
      .listClients(term ? { search: term } : {})
      .then(setPatients)
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // pesquisa com uma pequena espera, para nao consultar a cada tecla
    const timer = setTimeout(() => load(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search, load]);

  function handleCreated() {
    setModalOpen(false);
    load(search.trim());
  }

  return (
    <div className="patients-page">
      <div className="page-head">
        <h1>Pacientes</h1>
        <button className="btn btn-primary" type="button" onClick={() => setModalOpen(true)}>
          + Novo paciente
        </button>
      </div>

      <input
        className="input search-input"
        type="search"
        placeholder="Pesquisar por nome ou telefone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Pesquisar pacientes"
      />

      {errorMsg && <p className="error-text">{errorMsg}</p>}

      {!loading && patients.length === 0 && (
        <p className="empty">
          {search ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado ainda.'}
        </p>
      )}

      <ul className="patient-list">
        {patients.map((patient) => (
          <li key={patient.id}>
            <Link to={`/pacientes/${patient.id}`} className="patient-row card">
              <div className="patient-row-main">
                <span className="patient-name">{patient.name}</span>
                <span className="small muted">{patient.phone}</span>
              </div>
              <div className="patient-row-next">
                {patient.nextAppointment ? (
                  <span className="small">
                    Próxima consulta: {formatFull(patient.nextAppointment.date)} às{' '}
                    {patient.nextAppointment.startTime}
                  </span>
                ) : (
                  <span className="small muted">Sem consultas agendadas</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {modalOpen && <PatientModal onClose={() => setModalOpen(false)} onSaved={handleCreated} />}
    </div>
  );
}
