import { useState } from 'react';
import Modal from './Modal.jsx';
import DocumentsPanel from './DocumentsPanel.jsx';
import NoteColorPicker from './NoteColorPicker.jsx';
import { getNoteColor, saveNoteColor } from '../lib/noteColorPreferences.js';
import { api } from '../services/api.js';
import './note-modal.css';

/// Quem mostra notas (a barra lateral e a tela de Notas) escuta este aviso
/// para recarregar. Assim editar pela lateral atualiza as duas.
export const NOTES_CHANGED = 'agenda:notas-mudaram';
export const notifyNotesChanged = () => window.dispatchEvent(new CustomEvent(NOTES_CHANGED));

/// Criar ou editar uma nota. Cuida da própria gravação, então pode ser aberto
/// de qualquer tela — a lateral usa isso para não tirar a profissional de onde
/// ela está só para mexer em um lembrete.
export default function NoteModal({ note, onClose }) {
  const [title, setTitle] = useState(note.title ?? '');
  const [content, setContent] = useState(note.content ?? '');
  const [color, setColor] = useState(() => getNoteColor(note.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = note.id
        ? await api.updateNote(note.id, { title, content })
        : await api.createNote({ title, content });
      saveNoteColor(saved.id, color);
      notifyNotesChanged();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      wide={Boolean(note.id)}
      title={note.id ? 'Editar nota' : 'Nova nota'}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit" form="note-form" disabled={busy}>
            {busy ? 'Salvando...' : 'Salvar nota'}
          </button>
        </>
      }
    >
      {error && <p className="error-text">{error}</p>}

      <form id="note-form" onSubmit={handleSubmit}>
        <NoteColorPicker value={color} onChange={setColor} disabled={busy} />
        <p className="hint note-color-hint">A cor é salva apenas neste navegador.</p>
        <div className="field">
          <label htmlFor="note-title">Título</label>
          <input
            id="note-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ligar para Maria"
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="note-content">Conteúdo</label>
          <textarea
            id="note-content"
            className="textarea note-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Verificar o próximo atendimento."
          />
        </div>
      </form>

      {/* Anexo precisa de uma nota ja gravada para ficar preso a ela, entao
          na nota nova aparece so o aviso. */}
      {note.id ? (
        <div className="note-documents">
          <DocumentsPanel owner="notes" ownerId={note.id} onChange={notifyNotesChanged} />
        </div>
      ) : (
        <p className="hint note-documents-hint">
          Salve a nota para poder anexar uma foto ou um PDF a ela.
        </p>
      )}
    </Modal>
  );
}
