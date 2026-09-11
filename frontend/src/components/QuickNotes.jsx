import { useState } from 'react';
import './quick-notes.css';

const STORAGE_KEY = 'agenda:quick-notes:v1';

function readDraft() {
  try {
    return { text: localStorage.getItem(STORAGE_KEY) ?? '', failed: false };
  } catch {
    return { text: '', failed: true };
  }
}

export default function QuickNotes() {
  const [draft, setDraft] = useState(readDraft);

  function updateDraft(event) {
    const text = event.target.value;
    try {
      localStorage.setItem(STORAGE_KEY, text);
      setDraft({ text, failed: false });
    } catch {
      setDraft({ text, failed: true });
    }
  }

  return (
    <aside className="quick-notes card" aria-labelledby="quick-notes-title">
      <div className="quick-notes-head">
        <h2 id="quick-notes-title">Anotações rápidas</h2>
        <p className="hint">Um espaço para os lembretes do dia.</p>
      </div>
      <label className="sr-only" htmlFor="quick-notes-text">Escreva suas anotações rápidas</label>
      <textarea
        id="quick-notes-text"
        className="quick-notes-text"
        placeholder="Escreva aqui…"
        value={draft.text}
        onChange={updateDraft}
      />
      <p className={`quick-notes-status ${draft.failed ? 'quick-notes-error' : ''}`} role="status">
        {draft.failed
          ? 'Não foi possível salvar neste navegador. Copie seu texto antes de sair.'
          : 'Salvo automaticamente neste navegador.'}
      </p>
    </aside>
  );
}
