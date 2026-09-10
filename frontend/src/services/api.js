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

async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    signal,
    credentials: 'include', // o cookie de sessao viaja aqui
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
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

  listAppointments: (params = {}) => request(`/appointments${query(params)}`),
  summary: (params) => request(`/appointments/summary${query(params)}`),
  createAppointment: (data) => request('/appointments', { method: 'POST', body: data }),
  updateAppointment: (id, data) => request(`/appointments/${id}`, { method: 'PUT', body: data }),
  deleteAppointment: (id) => request(`/appointments/${id}`, { method: 'DELETE' }),

  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'PUT', body: data }),
};

export { ApiError };
