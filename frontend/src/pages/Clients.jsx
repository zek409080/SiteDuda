import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import ClientModal from '../components/ClientModal.jsx';
import { formatFull } from '../lib/date.js';
import './clients.css';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback((term) => {
    setLoading(true);
    setErrorMsg('');
    api
      .listClients(term ? { search: term } : {})
      .then(setClients)
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
    <div className="clients-page">
      <div className="page-head">
        <h1>Clientes</h1>
        <button className="btn btn-primary" type="button" onClick={() => setModalOpen(true)}>
          + Novo cliente
        </button>
      </div>

      <input
        className="input search-input"
        type="search"
        placeholder="Pesquisar por nome ou telefone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Pesquisar clientes"
      />

      {errorMsg && <p className="error-text">{errorMsg}</p>}

      {!loading && clients.length === 0 && (
        <p className="empty">
          {search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
        </p>
      )}

      <ul className="client-list">
        {clients.map((client) => (
          <li key={client.id}>
            <Link to={`/clientes/${client.id}`} className="client-row card">
              <div className="client-row-main">
                <span className="client-name">{client.name}</span>
                <span className="small muted">{client.phone}</span>
              </div>
              <div className="client-row-next">
                {client.nextAppointment ? (
                  <span className="small">
                    Próxima consulta: {formatFull(client.nextAppointment.date)} às {client.nextAppointment.startTime}
                  </span>
                ) : (
                  <span className="small muted">Sem consultas agendadas</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {modalOpen && <ClientModal onClose={() => setModalOpen(false)} onSaved={handleCreated} />}
    </div>
  );
}
