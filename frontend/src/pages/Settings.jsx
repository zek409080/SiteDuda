import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../lib/auth.jsx';
import './settings.css';

const DAYS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

export default function Settings() {
  const { settings, setSettings } = useAuth();
  const [form, setForm] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        professionalName: settings.professionalName,
        workStart: settings.workStart,
        workEnd: settings.workEnd,
        defaultDuration: settings.defaultDuration,
        workDays: settings.workDays,
      });
    }
  }, [settings]);

  if (!form) return null;

  function toggleDay(value) {
    setForm((prev) => ({
      ...prev,
      workDays: prev.workDays.includes(value)
        ? prev.workDays.filter((d) => d !== value)
        : [...prev.workDays, value].sort(),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess(false);

    if (newPin && newPin.length < 6) {
      setError('O novo PIN precisa ter ao menos 6 dígitos.');
      return;
    }
    if (newPin && newPin !== confirmPin) {
      setError('A confirmação do PIN não confere.');
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateSettings({ ...form, newPin: newPin || undefined });
      setSettings(updated);
      setNewPin('');
      setConfirmPin('');
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-page">
      <h1>Configurações</h1>

      <form className="card settings-card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="st-name">Nome da profissional</label>
          <input
            id="st-name"
            className="input"
            value={form.professionalName}
            onChange={(e) => setForm((p) => ({ ...p, professionalName: e.target.value }))}
            required
          />
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="st-start">Início do expediente</label>
            <input
              id="st-start"
              className="input"
              type="time"
              value={form.workStart}
              onChange={(e) => setForm((p) => ({ ...p, workStart: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="st-end">Fim do expediente</label>
            <input
              id="st-end"
              className="input"
              type="time"
              value={form.workEnd}
              onChange={(e) => setForm((p) => ({ ...p, workEnd: e.target.value }))}
              required
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="st-duration">Duração padrão da consulta</label>
          <select
            id="st-duration"
            className="select"
            value={form.defaultDuration}
            onChange={(e) => setForm((p) => ({ ...p, defaultDuration: Number(e.target.value) }))}
          >
            {[30, 40, 45, 50, 60, 80, 90].map((value) => (
              <option key={value} value={value}>
                {value} minutos
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Dias de atendimento</label>
          <div className="day-picker">
            {DAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                className={`day-chip ${form.workDays.includes(day.value) ? 'active' : ''}`}
                onClick={() => toggleDay(day.value)}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        <hr className="settings-divider" />

        <div className="field">
          <label htmlFor="st-pin">Novo PIN de acesso (opcional)</label>
          <input
            id="st-pin"
            className="input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Deixe em branco para manter o atual"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 20))}
          />
          <span className="hint">
            Mínimo de 6 dígitos. Ao trocar o PIN, você sai de todos os aparelhos conectados.
          </span>
        </div>

        {newPin && (
          <div className="field">
            <label htmlFor="st-pin-confirm">Confirmar novo PIN</label>
            <input
              id="st-pin-confirm"
              className="input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 20))}
            />
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">Configurações salvas.</p>}

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </form>
    </div>
  );
}
