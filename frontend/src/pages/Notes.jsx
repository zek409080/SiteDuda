import { useCallback, useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import NoteModal, { NOTES_CHANGED, notifyNotesChanged } from '../components/NoteModal.jsx';
import { api } from '../services/api.js';
import { useNoteColors, saveNoteColor } from '../lib/noteColorPreferences.js';
import { noteColorStyle } from '../lib/noteColors.js';
import './notes.css';

function formatDateTime(iso) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const noteColors = useNoteColors();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  // null = fechado; {} = nova nota; {id,...} = editando
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listNotes()
      .then(setNotes)
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Editar pela barra lateral também mexe nesta lista.
  useEffect(() => {
    window.addEventListener(NOTES_CHANGED, load);
    return () => window.removeEventListener(NOTES_CHANGED, load);
  }, [load]);

  async function confirmDelete() {
    setBusy(true);
    setErrorMsg('');
    try {
      await api.deleteNote(toDelete.id);
      saveNoteColor(toDelete.id, 'default');
      setToDelete(null);
      notifyNotesChanged();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notes-page">
      <div className="page-head">
        <h1>Notas</h1>
        <button className="btn btn-primary" type="button" onClick={() => setEditing({})}>
          + Nova nota
        </button>
      </div>

      <p className="hint notes-hint">
        Lembretes gerais do dia a dia. Não ficam ligados a nenhum paciente — para anotações de
        sessão, use o campo de observação do atendimento.
      </p>

      {errorMsg && <p className="error-text">{errorMsg}</p>}

      {loading ? (
        <p className="muted small">Carregando...</p>
      ) : notes.length === 0 ? (
        <p className="empty">Nenhuma nota ainda. Crie a primeira em "+ Nova nota".</p>
      ) : (
        <ul className="note-list">
          {notes.map((note) => (
            <li key={note.id} className="note-card card note-colored" style={noteColorStyle(noteColors[note.id])}>
              <h2 className="note-title">{note.title}</h2>
              {note.content && <p className="note-content">{note.content}</p>}

              <div className="note-foot">
                <span className="small muted note-meta">
                  {note.documentCount > 0 && (
                    <span className="note-clip" title={`${note.documentCount} anexo(s)`}>
                      📎 {note.documentCount}
                    </span>
                  )}
                  {note.createdAt === note.updatedAt
                    ? formatDateTime(note.createdAt)
                    : `Editada em ${formatDateTime(note.updatedAt)}`}
                </span>
                <div className="note-actions">
                  <button className="btn btn-sm" type="button" onClick={() => setEditing(note)}>
                    Editar
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    type="button"
                    onClick={() => setToDelete(note)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && <NoteModal note={editing} onClose={() => setEditing(null)} />}

      {toDelete && (
        <Modal
          title="Excluir nota"
          onClose={() => !busy && setToDelete(null)}
          footer={
            <>
              <button className="btn" type="button" onClick={() => setToDelete(null)} disabled={busy}>
                Cancelar
              </button>
              <button className="btn btn-danger" type="button" onClick={confirmDelete} disabled={busy}>
                {busy ? 'Excluindo...' : 'Excluir'}
              </button>
            </>
          }
        >
          <p>Tem certeza que deseja excluir esta nota?</p>
          <p className="small muted delete-target">{toDelete.title}</p>
        </Modal>
      )}
    </div>
  );
}
