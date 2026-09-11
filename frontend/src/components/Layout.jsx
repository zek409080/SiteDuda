import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../services/api.js';
import NoteModal, { NOTES_CHANGED } from './NoteModal.jsx';
import NavIcon from './NavIcon.jsx';
import { useNoteColors } from '../lib/noteColorPreferences.js';
import { noteColorStyle } from '../lib/noteColors.js';
import './layout.css';

/// `short` e o rotulo usado na barra do celular, onde nao cabe o nome
/// inteiro sem espremer os outros itens.
const LINKS = [
  { to: '/', label: 'Agenda', icon: 'agenda', end: true },
  { to: '/pacientes', label: 'Pacientes', icon: 'patients' },
  { to: '/notas', label: 'Notas', icon: 'notes' },
  { to: '/configuracoes', label: 'Configurações', short: 'Ajustes', icon: 'settings' },
];

/// Quantas notas cabem na lateral sem ela virar uma lista rolante.
const NA_LATERAL = 5;

export default function Layout() {
  const { settings, logout } = useAuth();
  const [notes, setNotes] = useState([]);
  const noteColors = useNoteColors();
  // null = fechado; {} = nova nota; {id,...} = editando.
  // O lembrete abre aqui mesmo, sobre a tela em que a profissional esta.
  const [openNote, setOpenNote] = useState(null);

  const loadNotes = useCallback(() => {
    api.listNotes().then(setNotes).catch(() => setNotes([]));
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // A tela de Notas avisa quando algo mudou, para a lateral nao ficar
  // mostrando um lembrete que acabou de ser apagado ou renomeado.
  useEffect(() => {
    window.addEventListener(NOTES_CHANGED, loadNotes);
    return () => window.removeEventListener(NOTES_CHANGED, loadNotes);
  }, [loadNotes]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-name">{settings?.professionalName ?? 'Minha Agenda'}</span>
          </div>

          <nav className="nav">
            {LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className="nav-link">
                <NavIcon name={link.icon} />
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Atalho para os lembretes, sempre à vista. Abrir um deles não
              troca de tela. Só na lateral do computador: no celular a barra
              de baixo já leva para Notas. */}
          <div className="side-notes">
            <div className="side-notes-head">
              <span className="side-notes-title">Notas</span>
              <button
                className="side-notes-add"
                type="button"
                onClick={() => setOpenNote({})}
                title="Nova nota"
                aria-label="Nova nota"
              >
                +
              </button>
            </div>

            {notes.length === 0 ? (
              <p className="side-notes-empty">Nenhuma nota ainda.</p>
            ) : (
              <ul className="side-notes-list">
                {notes.slice(0, NA_LATERAL).map((note) => (
                  <li key={note.id}>
                    <button
                      className="side-note note-colored"
                      style={noteColorStyle(noteColors[note.id])}
                      type="button"
                      title={note.title}
                      onClick={() => setOpenNote(note)}
                    >
                      <span className="side-note-title">{note.title}</span>
                      {note.documentCount > 0 && (
                        <span className="side-note-clip">📎 {note.documentCount}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {notes.length > NA_LATERAL && (
              <NavLink className="side-notes-all" to="/notas">
                Ver todas ({notes.length})
              </NavLink>
            )}
          </div>
        </div>

        <button className="nav-link nav-exit" type="button" onClick={logout}>
          <NavIcon name="exit" />
          Sair
        </button>
      </aside>

      <main className="content">
        <Outlet />
      </main>

      {openNote && <NoteModal note={openNote} onClose={() => setOpenNote(null)} />}

      {/* No celular a navegacao vai para a base da tela. */}
      <nav className="tabbar">
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className="tab">
            <NavIcon name={link.icon} />
            <span className="tab-label">{link.short ?? link.label}</span>
          </NavLink>
        ))}
        <button className="tab" type="button" onClick={logout}>
          <NavIcon name="exit" />
          <span className="tab-label">Sair</span>
        </button>
      </nav>
    </div>
  );
}
