/*
 * A roda do mouse sobre um campo de hora, data ou numero COM FOCO altera o
 * valor dele — entao rolar o formulario com o ponteiro parado em cima do
 * horario ia somando minutos sozinho.
 *
 * O ouvinte precisa ser nativo e nao-passivo: o `onWheel` do React e
 * registrado de forma passiva na raiz, e `preventDefault` ali nao segura o
 * incremento do navegador.
 *
 * So age quando o campo esta focado, entao passar o mouse por cima enquanto
 * rola a pagina continua funcionando normalmente.
 */
const CAMPOS_AFETADOS = ['time', 'date', 'datetime-local', 'number', 'month', 'week'];

export function blockWheelOnValueInputs() {
  const handler = (event) => {
    const el = event.target;
    if (
      el instanceof HTMLInputElement &&
      CAMPOS_AFETADOS.includes(el.type) &&
      document.activeElement === el
    ) {
      event.preventDefault();
    }
  };

  document.addEventListener('wheel', handler, { passive: false });
  return () => document.removeEventListener('wheel', handler);
}
