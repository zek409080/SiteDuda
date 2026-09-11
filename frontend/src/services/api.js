/* Unico ponto de contato do frontend com a API.
   Nenhuma tela fala com o banco diretamente. */

const BASE = '/api';

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, form, signal } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    signal,
    credentials: 'include', // o cookie de sessao viaja aqui
    // Envio de arquivo vai sem Content-Type: o navegador precisa montar o
    // cabecalho com a fronteira (boundary) do multipart sozinho.
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });

  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    // Sessao derrubada (PIN trocado, saiu em outro aparelho, prazo vencido):
    // volta para a tela do PIN em vez de mostrar um erro solto na pagina.
    if (response.status === 401 && path !== '/auth/session' && path !== '/auth/login') {
      window.dispatchEvent(new CustomEvent('agenda:sessao-encerrada'));
    }
    const detail = data?.details?.[0]?.mensagem;
    throw new ApiError(response.status, detail || data?.error || 'Não foi possível completar a ação', data?.details);
  }

  return data;
}

const query = (params) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString();
  return search ? `?${search}` : '';
};

export const api = {
  login: (pin) => request('/auth/login', { method: 'POST', body: { pin } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  session: () => request('/auth/session'),

  listClients: (params = {}) => request(`/clients${query(params)}`),
  getClient: (id) => request(`/clients/${id}`),
  createClient: (data) => request('/clients', { method: 'POST', body: data }),
  updateClient: (id, data) => request(`/clients/${id}`, { method: 'PUT', body: data }),
  deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),
  clientAppointments: (id) => request(`/clients/${id}/appointments`),

  // `dono` e 'clients' ou 'notes': paciente e nota guardam anexos do mesmo
  // jeito, so muda de quem o arquivo e.
  listDocuments: (dono, id) => request(`/${dono}/${id}/documents`),
  uploadDocument: (dono, id, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/${dono}/${id}/documents`, { method: 'POST', form });
  },
  deleteDocument: (dono, id, documentId) =>
    request(`/${dono}/${id}/documents/${documentId}`, { method: 'DELETE' }),

  listAppointments: (params = {}) => request(`/appointments${query(params)}`),
  summary: (params) => request(`/appointments/summary${query(params)}`),
  createAppointment: (data) => request('/appointments', { method: 'POST', body: data }),
  updateAppointment: (id, data) => request(`/appointments/${id}`, { method: 'PUT', body: data }),
  // `scope` diz o alcance dentro de uma serie: one (so este),
  // following (este e os proximos) ou series (todos).
  deleteAppointment: (id, scope = 'one') =>
    request(`/appointments/${id}${query({ scope })}`, { method: 'DELETE' }),

  listNotes: () => request('/notes'),
  createNote: (data) => request('/notes', { method: 'POST', body: data }),
  updateNote: (id, data) => request(`/notes/${id}`, { method: 'PUT', body: data }),
  deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),

  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'PUT', body: data }),
};

/// Endereco do arquivo de um documento. Nao e um link publico: o servidor
/// so entrega depois de conferir a sessao e que o documento e mesmo daquele
/// dono. Sem isso, abrir o endereco direto devolve 401.
export function documentFileUrl(dono, id, documentId, { download = false } = {}) {
  return `${BASE}/${dono}/${id}/documents/${documentId}/file${download ? '?download=1' : ''}`;
}

export { ApiError };
