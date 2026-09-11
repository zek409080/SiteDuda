import { useState } from 'react';
import './patient-form.css';

const RELATIONS = ['Mãe', 'Pai', 'Responsável legal', 'Avó', 'Avô', 'Outro'];

/// Cada linha das listas precisa de uma chave estavel para o React nao
/// embaralhar o que esta sendo digitado quando um item e removido no meio.
/// Item vindo do banco usa o id; item recem-criado usa um contador local.
let nextKey = 0;
const withKey = (item) => ({ ...item, _key: item.id ?? `novo-${(nextKey += 1)}` });

export default function PatientForm({ initial, onSubmit }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    birthDate: initial?.birthDate ?? '',
    address: initial?.address ?? '',
    notes: initial?.notes ?? '',
    hasAllergies: initial?.hasAllergies ?? false,
    responsibles: (initial?.responsibles ?? []).map(withKey),
    allergies: (initial?.allergies ?? []).map(withKey),
    medications: (initial?.medications ?? []).map(withKey),
  }));

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const addItem = (listKey, blank) =>
    setForm((prev) => ({ ...prev, [listKey]: [...prev[listKey], withKey(blank)] }));

  const removeItem = (listKey, key) =>
    setForm((prev) => ({ ...prev, [listKey]: prev[listKey].filter((i) => i._key !== key) }));

  const setItem = (listKey, key, field) => (event) =>
    setForm((prev) => ({
      ...prev,
      [listKey]: prev[listKey].map((item) =>
        item._key === key ? { ...item, [field]: event.target.value } : item,
      ),
    }));

  function handleSubmit(event) {
    event.preventDefault();
    // `_key` e so do navegador; o servidor recebe os campos de verdade.
    const strip = (list) => list.map(({ _key, id, ...rest }) => rest);
    onSubmit({
      ...form,
      responsibles: strip(form.responsibles),
      allergies: form.hasAllergies ? strip(form.allergies) : [],
      medications: strip(form.medications),
    });
  }

  return (
    <form id="patient-form" onSubmit={handleSubmit} className="patient-form">
      <fieldset className="form-section">
        <legend>Dados pessoais</legend>

        <div className="field">
          <label htmlFor="pa-name">Nome completo</label>
          <input id="pa-name" className="input" value={form.name} onChange={set('name')} required autoFocus />
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="pa-phone">Telefone</label>
            <input
              id="pa-phone"
              className="input"
              type="tel"
              placeholder="(11) 90000-0000"
              value={form.phone}
              onChange={set('phone')}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="pa-birth">Data de nascimento</label>
            <input
              id="pa-birth"
              className="input"
              type="date"
              value={form.birthDate ?? ''}
              onChange={set('birthDate')}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="pa-email">E-mail</label>
          <input id="pa-email" className="input" type="email" value={form.email ?? ''} onChange={set('email')} />
        </div>

        <div className="field">
          <label htmlFor="pa-address">Endereço</label>
          <input id="pa-address" className="input" value={form.address ?? ''} onChange={set('address')} />
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Responsáveis</legend>
        <p className="hint section-hint">
          Opcional. Preencha quando o paciente tiver um responsável pelo acompanhamento.
        </p>

        {form.responsibles.map((item, index) => (
          <div className="list-item" key={item._key}>
            <div className="list-item-head">
              <span className="list-item-title">Responsável {index + 1}</span>
              <button
                className="btn btn-danger btn-sm"
                type="button"
                onClick={() => removeItem('responsibles', item._key)}
              >
                Remover
              </button>
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor={`resp-name-${item._key}`}>Nome completo</label>
                <input
                  id={`resp-name-${item._key}`}
                  className="input"
                  value={item.name ?? ''}
                  onChange={setItem('responsibles', item._key, 'name')}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`resp-rel-${item._key}`}>Relação</label>
                <select
                  id={`resp-rel-${item._key}`}
                  className="select"
                  value={item.relation ?? 'Mãe'}
                  onChange={setItem('responsibles', item._key, 'relation')}
                >
                  {RELATIONS.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor={`resp-phone-${item._key}`}>Telefone</label>
                <input
                  id={`resp-phone-${item._key}`}
                  className="input"
                  type="tel"
                  value={item.phone ?? ''}
                  onChange={setItem('responsibles', item._key, 'phone')}
                />
              </div>
              <div className="field">
                <label htmlFor={`resp-email-${item._key}`}>E-mail</label>
                <input
                  id={`resp-email-${item._key}`}
                  className="input"
                  type="email"
                  value={item.email ?? ''}
                  onChange={setItem('responsibles', item._key, 'email')}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`resp-notes-${item._key}`}>Observações</label>
              <input
                id={`resp-notes-${item._key}`}
                className="input"
                value={item.notes ?? ''}
                onChange={setItem('responsibles', item._key, 'notes')}
              />
            </div>
          </div>
        ))}

        <button
          className="btn btn-add"
          type="button"
          onClick={() => addItem('responsibles', { name: '', relation: 'Mãe', phone: '', email: '', notes: '' })}
        >
          + Adicionar responsável
        </button>
      </fieldset>

      <fieldset className="form-section">
        <legend>Informações de saúde</legend>

        <div className="field">
          <span className="group-label">Alergias</span>
          <div className="choice-group">
            <label className="choice">
              <input
                type="radio"
                name="has-allergies"
                checked={!form.hasAllergies}
                onChange={() => setForm((prev) => ({ ...prev, hasAllergies: false }))}
              />
              Nenhuma conhecida
            </label>
            <label className="choice">
              <input
                type="radio"
                name="has-allergies"
                checked={form.hasAllergies}
                onChange={() => setForm((prev) => ({ ...prev, hasAllergies: true }))}
              />
              Possui alergias
            </label>
          </div>
        </div>

        {form.hasAllergies && (
          <>
            {form.allergies.map((item) => (
              <div className="list-item" key={item._key}>
                <div className="list-item-head">
                  <span className="list-item-title">Alergia</span>
                  <button
                    className="btn btn-danger btn-sm"
                    type="button"
                    onClick={() => removeItem('allergies', item._key)}
                  >
                    Remover
                  </button>
                </div>
                <div className="field">
                  <label htmlFor={`alg-name-${item._key}`}>Alergia a</label>
                  <input
                    id={`alg-name-${item._key}`}
                    className="input"
                    placeholder="Penicilina"
                    value={item.name ?? ''}
                    onChange={setItem('allergies', item._key, 'name')}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor={`alg-notes-${item._key}`}>Observação</label>
                  <input
                    id={`alg-notes-${item._key}`}
                    className="input"
                    placeholder="Reação relatada, cuidados..."
                    value={item.notes ?? ''}
                    onChange={setItem('allergies', item._key, 'notes')}
                  />
                </div>
              </div>
            ))}

            <button
              className="btn btn-add"
              type="button"
              onClick={() => addItem('allergies', { name: '', notes: '' })}
            >
              + Adicionar alergia
            </button>
          </>
        )}

        <div className="field medication-block">
          <span className="group-label">Medicamentos em uso</span>
        </div>

        {form.medications.map((item) => (
          <div className="list-item" key={item._key}>
            <div className="list-item-head">
              <span className="list-item-title">Medicamento</span>
              <button
                className="btn btn-danger btn-sm"
                type="button"
                onClick={() => removeItem('medications', item._key)}
              >
                Remover
              </button>
            </div>

            <div className="field">
              <label htmlFor={`med-name-${item._key}`}>Nome do medicamento</label>
              <input
                id={`med-name-${item._key}`}
                className="input"
                placeholder="Sertralina"
                value={item.name ?? ''}
                onChange={setItem('medications', item._key, 'name')}
                required
              />
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor={`med-dose-${item._key}`}>Dosagem</label>
                <input
                  id={`med-dose-${item._key}`}
                  className="input"
                  placeholder="50 mg"
                  value={item.dosage ?? ''}
                  onChange={setItem('medications', item._key, 'dosage')}
                />
              </div>
              <div className="field">
                <label htmlFor={`med-freq-${item._key}`}>Frequência</label>
                <input
                  id={`med-freq-${item._key}`}
                  className="input"
                  placeholder="1 vez ao dia"
                  value={item.frequency ?? ''}
                  onChange={setItem('medications', item._key, 'frequency')}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`med-notes-${item._key}`}>Observação</label>
              <input
                id={`med-notes-${item._key}`}
                className="input"
                placeholder="Uso contínuo"
                value={item.notes ?? ''}
                onChange={setItem('medications', item._key, 'notes')}
              />
            </div>
          </div>
        ))}

        <button
          className="btn btn-add"
          type="button"
          onClick={() => addItem('medications', { name: '', dosage: '', frequency: '', notes: '' })}
        >
          + Adicionar medicamento
        </button>
      </fieldset>

      <fieldset className="form-section">
        <legend>Observações gerais</legend>
        <div className="field">
          <label htmlFor="pa-notes" className="sr-only">
            Observações gerais
          </label>
          <textarea id="pa-notes" className="textarea" value={form.notes ?? ''} onChange={set('notes')} />
        </div>
      </fieldset>

      {/* Salvar/Cancelar ficam no rodape do modal que envolve este formulario. */}
    </form>
  );
}
