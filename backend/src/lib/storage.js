import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { badRequest } from '../utils/errors.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/*
 * Onde os arquivos ficam.
 *
 * Fora do banco, de proposito: guardar PDF e imagem como BLOB engorda o dump
 * e deixa toda consulta mais lenta. O banco guarda so os metadados.
 *
 * ATENCAO na hospedagem: o disco de um container e descartado a cada deploy.
 * Para os documentos sobreviverem e preciso montar um volume e apontar
 * UPLOAD_DIR para ele (veja a secao de backup no README).
 */
export const uploadDir = path.resolve(
  process.env.UPLOAD_DIR?.trim() || path.join(backendRoot, 'uploads'),
);

/// 10 MB por arquivo. Cobre com folga PDF de avaliacao e foto de documento,
/// e segura o consumo de disco de um plano de hospedagem pequeno.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/*
 * Tipos aceitos. O tipo declarado pelo navegador nao decide nada sozinho:
 * a extensao gravada em disco sai SEMPRE desta tabela, nunca do nome enviado.
 * Assim ninguem consegue gravar um ".html" ou um ".js" na pasta de uploads.
 */
const ALLOWED = {
  'application/pdf': { ext: '.pdf', inline: true },
  'image/png': { ext: '.png', inline: true },
  'image/jpeg': { ext: '.jpg', inline: true },
  'application/msword': { ext: '.doc', inline: false },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    ext: '.docx',
    inline: false,
  },
};

const EXT_TO_MIME = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const ACCEPT_ATTRIBUTE = '.pdf,.png,.jpg,.jpeg,.doc,.docx';

/// Navegadores as vezes mandam um tipo generico. Nesse caso a extensao do
/// nome original desempata — mas so para escolher uma entrada da tabela
/// acima; o valor gravado continua vindo da tabela.
function resolveType(file) {
  const declared = String(file.mimetype || '').toLowerCase();
  if (ALLOWED[declared]) return declared;
  const ext = path.extname(file.originalname || '').toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

/// Guarda o nome que a profissional vai ler na tela, sem deixar passar
/// caminho ou caractere de controle.
/// O multer entrega o nome do arquivo decodificado como latin1, entao
/// "Avaliação.pdf" chegaria como "AvaliaÃ§Ã£o.pdf". Refaz a leitura dos
/// bytes como UTF-8; se o resultado nao for UTF-8 valido, o nome ja estava
/// correto e e mantido como veio.
function decodeFileName(name) {
  const raw = String(name || '');
  const utf8 = Buffer.from(raw, 'latin1').toString('utf8');
  return utf8.includes('�') ? raw : utf8;
}

function safeOriginalName(name) {
  const base = path.basename(decodeFileName(name || 'documento'));
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (clean || 'documento').slice(0, 255);
}

export function isInlineType(mimeType) {
  return ALLOWED[mimeType]?.inline === true;
}

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const type = resolveType(file);
    if (!type) return cb(badRequest('Formato de arquivo não aceito'));
    cb(null, `${crypto.randomUUID()}${ALLOWED[type].ext}`);
  },
});

export const uploadSingleDocument = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!resolveType(file)) {
      return cb(badRequest('Envie um arquivo PDF, PNG, JPG, DOC ou DOCX'));
    }
    cb(null, true);
  },
}).single('file');

/// Dados ja normalizados do arquivo recebido, prontos para ir ao banco.
export function describeUpload(file) {
  return {
    originalName: safeOriginalName(file.originalname),
    storageName: file.filename,
    mimeType: resolveType(file),
    fileSize: file.size,
    storagePath: file.filename,
  };
}

/// Caminho absoluto de um documento, recusando qualquer valor que aponte
/// para fora da pasta de uploads (defesa contra "../" gravado no banco).
export function absolutePathFor(storagePath) {
  const full = path.resolve(uploadDir, storagePath);
  const root = uploadDir.endsWith(path.sep) ? uploadDir : uploadDir + path.sep;
  if (full !== uploadDir && !full.startsWith(root)) return null;
  return full;
}

/// Apaga o arquivo do disco. Some silenciosamente se ele ja nao existir:
/// o objetivo e nao sobrar arquivo, e um arquivo ausente ja atende isso.
export async function removeStoredFile(storagePath) {
  const full = absolutePathFor(storagePath);
  if (!full) return;
  await fs.promises.rm(full, { force: true });
}
