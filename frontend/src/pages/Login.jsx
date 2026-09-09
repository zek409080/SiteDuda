import { useRef, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import './login.css';

const LENGTH = 4;

export default function Login() {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  async function submit(event) {
    event?.preventDefault();
    if (pin.length < LENGTH || busy) return;
    setBusy(true);
    setError('');
    try {
      await login(pin);
    } catch (err) {
      setError(err.message);
      setPin('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  function handleChange(event) {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
    setPin(digits);
    setError('');
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-mark" aria-hidden="true">
          <span />
        </div>
        <h1>Minha Agenda</h1>
        <p className="muted small">Digite seu PIN para entrar</p>

        <button
          type="button"
          className="pin-display"
          onClick={() => inputRef.current?.focus()}
          aria-label="Campo do PIN"
        >
          {Array.from({ length: Math.max(LENGTH, pin.length) }).map((_, index) => (
            <span key={index} className={`pin-dot ${index < pin.length ? 'filled' : ''}`} />
          ))}
        </button>

        <input
          ref={inputRef}
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={handleChange}
          aria-label="PIN de acesso"
        />

        {error && <p className="login-error">{error}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={pin.length < LENGTH || busy}>
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
