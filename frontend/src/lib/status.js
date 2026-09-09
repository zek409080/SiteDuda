export const STATUS = {
  AGENDADO: 'Agendado',
  CONFIRMADO: 'Confirmado',
  REALIZADO: 'Realizado',
  CANCELADO: 'Cancelado',
  FALTOU: 'Faltou',
};

export const STATUS_LIST = Object.keys(STATUS);

export const statusLabel = (value) => STATUS[value] ?? value;
