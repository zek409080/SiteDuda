import { useState } from 'react';

export default function ClientForm({ initial, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    birthDate: initial?.birthDate ?? '',
    notes: initial?.notes ?? '',
  }));

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <form id="client-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="cl-name">Nome completo</label>
        <input id="cl-name" className="input" value={form.name} onChange={set('name')} required autoFocus />
      </div>

      <div className="field">
        <label htmlFor="cl-phone">Telefone</label>
        <input
          id="cl-phone"
          className="input"
          type="tel"
          placeholder="(11) 90000-0000"
          value={form.phone}
          onChange={set('phone')}
          required
        />
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="cl-email">E-mail (opcional)</label>
          <input id="cl-email" className="input" type="email" value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="cl-birth">Nascimento (opcional)</label>
          <input id="cl-birth" className="input" type="date" value={form.birthDate ?? ''} onChange={set('birthDate')} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="cl-notes">Observações gerais (opcional)</label>
        <textarea id="cl-notes" className="textarea" value={form.notes ?? ''} onChange={set('notes')} />
      </div>

      {/* Salvar/Cancelar ficam no rodape do modal que envolve este formulario. */}
    </form>
  );
}
