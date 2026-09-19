export const STATUS = {
  AGENDADO: 'Agendado',
  REALIZADO: 'Realizado',
  CANCELADO: 'Cancelado',
  FALTOU: 'Faltou',
};

export const STATUS_LIST = Object.keys(STATUS);

// Consultas antigas podem continuar armazenadas como CONFIRMADO. Na interface,
// elas passam a seguir o mesmo padrão visual e textual de AGENDADO.
export const displayStatus = (value) => (value === 'CONFIRMADO' ? 'AGENDADO' : value);

export const statusLabel = (value) => STATUS[displayStatus(value)] ?? value;
