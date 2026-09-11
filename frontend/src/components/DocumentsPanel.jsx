import { useCallback, useEffect, useRef, useState } from 'react';
import { api, documentFileUrl } from '../services/api.js';
import './documents-panel.css';

/// Mesma lista aceita pelo servidor. Aqui ela so filtra o seletor de
/// arquivos do sistema; quem decide de verdade e o backend.
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.doc,.docx';

const IMAGE_TYPES = ['image/png', 'image/jpeg'];

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const formatDate = (iso) => new Date(iso).toLocaleDateString('pt-BR');

/// Rotulo curto do tipo, tirado do nome do arquivo (que ja foi limpo pelo
/// servidor) para nao mostrar o MIME inteiro na tela.
function typeLabel(name) {
  const ext = name.split('.').pop();
  return ext && ext.length <= 5 ? ext.toUpperCase() : 'ARQUIVO';
}

/**
 * Lista de anexos com envio, visualizacao, download e exclusao.
 *
 * `owner` e 'clients' ou 'notes'. A confirmacao de exclusao acontece na
 * propria linha, e nao em outro modal: este painel tambem aparece dentro do
 * modal da nota, e empilhar dois modais faria a tecla Esc fechar os dois.
 */
export default function DocumentsPanel({ owner, ownerId, onChange }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listDocuments(owner, ownerId)
      .then(setDocuments)
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, [owner, ownerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    // Limpa o seletor na hora: sem isso, escolher o mesmo arquivo de novo
    // nao dispara o evento e o envio parece travado.
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setErrorMsg('');
    try {
      const saved = await api.uploadDocument(owner, ownerId, file);
      setDocuments((prev) => [saved, ...prev]);
      onChange?.();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete(documentId) {
    setDeleting(true);
    setErrorMsg('');
    try {
      await api.deleteDocument(owner, ownerId, documentId);
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      setConfirmingId(null);
      onChange?.();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="documents-panel">
      <div className="spread documents-head">
        <h2 className="panel-title">Documentos</h2>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Enviando...' : '+ Adicionar documento'}
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={handleFile}
        aria-label="Escolher documento para enviar"
      />

      <p className="hint documents-hint">
        Aceita PDF, PNG, JPG, DOC e DOCX, até 10 MB por arquivo. Os documentos são privados: só
        abrem com a sessão iniciada.
      </p>

      {errorMsg && <p className="error-text">{errorMsg}</p>}

      {loading ? (
        <p className="muted small">Carregando...</p>
      ) : documents.length === 0 ? (
        <p className="documents-empty">Nenhum documento enviado ainda.</p>
      ) : (
        <ul className="document-list">
          {documents.map((doc) => (
            <li key={doc.id} className="document-row">
              <span className="document-icon" aria-hidden="true">
                {IMAGE_TYPES.includes(doc.mimeType) ? '🖼' : '📄'}
              </span>

              <div className="document-main">
                <span className="document-name">{doc.originalName}</span>
                <span className="small muted">
                  {typeLabel(doc.originalName)} • {formatSize(doc.fileSize)} •{' '}
                  {formatDate(doc.createdAt)}
                </span>
              </div>

              {confirmingId === doc.id ? (
                <div className="document-actions">
                  <span className="small muted document-confirm">Excluir este documento?</span>
                  <button
                    className="btn btn-sm"
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    disabled={deleting}
                  >
                    Voltar
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    type="button"
                    onClick={() => confirmDelete(doc.id)}
                    disabled={deleting}
                  >
                    {deleting ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              ) : (
                <div className="document-actions">
                  <a
                    className="btn btn-sm"
                    href={documentFileUrl(owner, ownerId, doc.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visualizar
                  </a>
                  <a
                    className="btn btn-sm"
                    href={documentFileUrl(owner, ownerId, doc.id, { download: true })}
                  >
                    Baixar
                  </a>
                  <button
                    className="btn btn-danger btn-sm"
                    type="button"
                    onClick={() => setConfirmingId(doc.id)}
                  >
                    Excluir
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
