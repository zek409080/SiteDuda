# Minha Agenda

Agenda digital pessoal para uma psicóloga organizar seus próprios atendimentos:
visualizar a agenda por dia, semana ou mês, cadastrar pacientes, criar e editar
agendamentos, marcar status (agendado, confirmado, realizado, cancelado,
faltou) e guardar observações privadas de cada sessão.

Cada paciente tem uma página própria, dividida em **Informações**,
**Responsáveis**, **Saúde** (alergias e medicamentos), **Documentos** (PDF,
imagens e arquivos do Word) e **Atendimentos**.

Há também um bloco de **Notas** para lembretes gerais da profissional, e os
atendimentos podem ser criados em série (**semanal, quinzenal, mensal** ou
personalizada).

Feita para **uma única pessoa**. Não há cadastro de usuários, múltiplos
perfis, portal do paciente ou qualquer coisa parecida com um sistema de
clínica — só uma agenda simples, protegida por PIN.

## Sumário

- [Stack utilizada](#stack-utilizada)
- [Cores](#cores)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Instalação passo a passo](#instalação-passo-a-passo)
- [Configurar o PIN de acesso](#configurar-o-pin-de-acesso)
- [Dados de teste](#dados-de-teste)
- [Documentos dos pacientes](#documentos-dos-pacientes)
- [Notas](#notas)
- [Agendamento recorrente](#agendamento-recorrente)
- [Backup](#backup)
- [Rodando os testes automatizados](#rodando-os-testes-automatizados)
- [Deploy em produção](#deploy-em-produção)
- [Segurança](#segurança)
- [Privacidade e LGPD](#privacidade-e-lgpd)
- [O que este sistema propositalmente não faz](#o-que-este-sistema-propositalmente-não-faz)

## Stack utilizada

- **Frontend:** React + Vite (sem framework CSS, estilos próprios)
- **Backend:** Node.js + Express
- **Banco de dados:** PostgreSQL
- **ORM:** Prisma
- **Autenticação:** PIN único, guardado com hash (bcrypt) + cookie de sessão
  assinado (JWT), sem sistema de contas

## Cores

Todas as cores da interface saem de variáveis CSS em
`frontend/src/styles/global.css`. Para mudar o visual, mexa lá — nenhuma tela
inventa cor por conta própria.

| Onde | Variável | Valor |
|---|---|---|
| Fundo da página | `--bg` | `#efdeff` (lavanda) |
| Cartões, modais, barra lateral | `--surface` | `#ffffff` |
| Destaques da marca | `--accent` | `#3d6a2c` (verde) |
| Hover do botão principal | `--accent-dark` | `#2f5321` |
| Item ativo, foco, badge | `--accent-soft` | `#eef4ea` |

O verde aparece **só nos detalhes**: botão principal, item selecionado do
menu, anel de foco, links, dias marcados e blocos da agenda. O conteúdo em si
fica sempre em cartão branco sobre o fundo lavanda.

## Estrutura do projeto

```
SiteDuda/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # tabelas: clients, appointments, settings,
│   │   │                       #          client_responsibles, client_allergies,
│   │   │                       #          client_medications, client_documents,
│   │   │                       #          notes, note_documents
│   │   ├── migrations/
│   │   └── seed.js            # dados fictícios para teste
│   ├── src/
│   │   ├── config/            # variáveis de ambiente
│   │   ├── lib/                # cliente do Prisma, armazenamento de arquivos
│   │   ├── middlewares/        # autenticação, validação, erros
│   │   ├── routes/             # endpoints HTTP + validações (zod)
│   │   ├── services/           # regras de negócio (conflito de horário, etc.)
│   │   ├── app.js
│   │   └── server.js
│   ├── uploads/                # documentos enviados (fora do Git; veja Backup)
│   └── tests/                  # testes automatizados (node --test)
└── frontend/
    └── src/
        ├── components/         # Layout, modais, formulários
        ├── pages/               # Agenda, Pacientes, Página do paciente, Notas,
        │                         # Configurações, Login
        ├── services/api.js     # único ponto de contato com a API
        └── lib/                 # datas, status, autenticação (contexto React)
```

O frontend **nunca** acessa o banco diretamente — toda a comunicação passa
pela API (`frontend → API → backend → PostgreSQL`).

> **Sobre "cliente" e "paciente":** a interface usa **paciente** em todo
> lugar. No banco e na API a tabela principal continua sendo `clients`, e as
> novas nasceram com o mesmo prefixo (`client_responsibles`,
> `client_allergies`, `client_medications`, `client_documents`). Renomear a
> tabela existente obrigaria a migrar dados já em produção sem ganho nenhum
> para quem usa o sistema, e misturar `patient_documents` apontando para
> `clients.id` seria pior de ler do que manter um prefixo só.

## Pré-requisitos

- [Node.js](https://nodejs.org) 20 ou superior
- [PostgreSQL](https://www.postgresql.org/download/) 15 ou superior (local ou
  em um serviço na nuvem, como Neon, Supabase ou Railway)

## Instalação passo a passo

### 1. Criar o banco de dados

Com o PostgreSQL instalado e rodando, crie um banco vazio:

```bash
createdb agenda
```

(ou use uma ferramenta gráfica como pgAdmin/DBeaver, ou o painel do serviço
na nuvem escolhido — nesse caso você já recebe a `DATABASE_URL` pronta).

### 2. Configurar o backend

```bash
cd backend
npm install
cp .env.example .env
```

Edite o arquivo `.env` e preencha:

```ini
DATABASE_URL="postgresql://usuario:senha@localhost:5432/agenda?schema=public"
SESSION_SECRET="gere-um-valor-aleatorio-longo-aqui"
ACCESS_PIN="1234"
```

Para gerar um `SESSION_SECRET` aleatório:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`ACCESS_PIN` só é usado **na primeira vez** que o sistema roda (quando ainda
não existe nenhuma configuração salva no banco). Depois disso o PIN mora no
banco (com hash) e é alterado pela tela de **Configurações**.

### 3. Criar as tabelas no banco

```bash
npm run db:migrate
```

Isso aplica as migrations do Prisma e cria as tabelas `clients`,
`appointments` e `settings`.

### 4. Rodar o backend

```bash
npm run dev
```

A API sobe em `http://localhost:4000`. Teste com:

```bash
curl http://localhost:4000/api/health
```

### 5. Configurar e rodar o frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5173`, digite o PIN configurado (`1234` por padrão)
e a agenda abre imediatamente.

## Banco de dados local já configurado nesta máquina

Durante o desenvolvimento, o PostgreSQL 17 foi instalado nesta máquina via
`winget` e um banco próprio para o projeto foi criado em
`backend/.pgdata` (fora do `Program Files`, para não depender de permissão
de administrador), rodando na porta **5433** com o usuário `agenda_admin`.
O `backend/.env` já está apontando para ele. Esse banco **não é** um serviço
do Windows, então não inicia sozinho ao reiniciar o computador. Para
ligá-lo/desligá-lo, dentro da pasta `backend`:

```bash
npm run db:local:start
npm run db:local:status
npm run db:local:stop
```

Para não precisar rodar isso toda vez, duas opções mais definitivas quando
for usar o sistema de verdade:

1. **Usar o serviço do PostgreSQL que o instalador já deixou rodando**
   (`postgresql-x64-17`, inicia sozinho com o Windows, na porta 5432) — basta
   definir uma senha para o usuário `postgres` dele (com um cliente como
   pgAdmin, ou `psql` com permissão de administrador) e trocar a
   `DATABASE_URL` no `.env` para apontar para a porta 5432.
2. **Usar um banco gerenciado na nuvem** (Neon, Supabase, Railway — todos têm
   camada gratuita), que já fica sempre disponível sem depender do seu
   computador estar ligado. Basta trocar a `DATABASE_URL`.

## Configurar o PIN de acesso

- **Definição inicial:** variável `ACCESS_PIN` no `.env` do backend (padrão
  `1234` — troque antes de usar de verdade).
- **Troca posterior:** menu **⚙ Configurações** → campo "Novo PIN de acesso".
- **Esqueceu o PIN?** Como ele é guardado com hash (não dá para "ler" o PIN
  antigo), a forma mais simples de resetar é apagar a linha da tabela
  `settings` no banco (ela é recriada automaticamente com o `ACCESS_PIN` do
  `.env` na próxima vez que o servidor iniciar):

  ```sql
  DELETE FROM settings WHERE id = 1;
  ```

## Dados de teste

Para popular o banco com 5 pacientes fictícios e alguns agendamentos de
exemplo (útil para testar o sistema antes do uso real):

```bash
cd backend
npm run seed
```

O script não roda se já existir algum paciente cadastrado, para nunca
sobrescrever dados reais sem querer. Para remover **todos** os pacientes e
agendamentos (dados de teste inclusive) e recomeçar do zero:

```bash
npm run seed:clear
```

⚠️ `seed:clear` apaga todos os pacientes e agendamentos do banco — não use em
um banco com dados reais de atendimentos.

## Documentos dos pacientes

Cada paciente tem uma aba **Documentos** onde é possível anexar arquivos do
acompanhamento: avaliações, encaminhamentos, fotos de desenhos, relatórios
escolares.

**Formatos aceitos:** PDF, PNG, JPG/JPEG, DOC e DOCX.
**Tamanho máximo:** 10 MB por arquivo.

O limite de 10 MB foi escolhido porque cobre com folga um PDF de avaliação
digitalizado e uma foto de documento, sem deixar o disco da hospedagem
crescer rápido demais. Para mudá-lo, ajuste `MAX_FILE_BYTES` em
`backend/src/lib/storage.js`.

### Onde os arquivos ficam

Os arquivos **não** vão para dentro do banco. O PostgreSQL guarda só os
metadados (nome original, tipo, tamanho, data, paciente); o arquivo em si
fica no disco, na pasta indicada por `UPLOAD_DIR` — por padrão
`backend/uploads`. Guardar PDF e imagem como BLOB engordaria o dump do banco
e deixaria toda consulta mais lenta.

O nome do arquivo em disco é gerado pelo servidor (um identificador único
mais a extensão correspondente ao tipo aceito). O nome enviado pelo navegador
é guardado apenas para exibir na tela e **nunca** vira caminho de arquivo.

> ⚠️ **Na hospedagem isso exige um volume.** O disco de um container é
> apagado a cada deploy. No Railway: *Service → Volumes → New Volume*, monte
> em `/data` e defina `UPLOAD_DIR=/data/uploads`. Sem isso, os documentos
> desaparecem no próximo deploy.

### Como o acesso é protegido

Não existe URL pública de arquivo. Para abrir um documento é preciso passar
por `GET /api/clients/:id/documents/:documentId/file`, que exige sessão
válida **e** confere que o documento pertence àquele paciente. Trocar o id do
paciente na URL não alcança o arquivo de outro: a consulta casa os dois ids.

Sem sessão a resposta é `401`; com sessão, mas com id trocado, é `404`.
DOC e DOCX sempre chegam como download, nunca abrem dentro do navegador.

## Notas

Um bloco de anotações livre da profissional, em **Notas** no menu lateral.
Serve para lembretes do dia a dia — "ligar para a paciente X", "comprar
material para o consultório", "reunião na sexta".

As notas **não** têm vínculo com paciente, de propósito. Anotação de sessão
continua no campo de observação do atendimento, onde ela pertence ao
histórico clínico daquela pessoa; nota é recado solto da agenda.

Cada nota guarda título, conteúdo, data de criação e data da última
alteração, e fica no banco (tabela `notes`) — nada em `localStorage`. A lista
aparece ordenada pela mais recentemente mexida.

### Notas na barra lateral

As cinco notas mais recentes aparecem na lateral, abaixo do menu. Clicar em
uma delas abre a nota **sobre a tela atual**, sem trocar de página — a
profissional consulta um lembrete no meio da agenda e continua de onde
estava. O `+` ao lado cria uma nota nova do mesmo jeito. Passando de cinco,
aparece "Ver todas", que aí sim leva à página de Notas.

As duas listas ficam em sincronia: mexer pela lateral atualiza a página de
Notas, e vice-versa.

### Anexos da nota

Uma nota também aceita arquivos — mesma lista de formatos e mesmo limite dos
[documentos de paciente](#documentos-dos-pacientes), e a mesma proteção: não
há URL pública, o acesso passa pela sessão e o servidor confere que o arquivo
é mesmo daquela nota.

Os metadados ficam em `note_documents`, uma tabela separada de
`client_documents`. Poderia ser uma tabela só com dois donos possíveis, mas
aí a chave estrangeira deixaria de ser obrigatória e nada garantiria que todo
anexo tem dono. Com tabelas separadas, apagar a nota leva os anexos junto
pelo próprio banco. A mecânica compartilhada (enviar, abrir, apagar, limpar o
arquivo do disco) mora uma vez só, em `documents.service.js` e
`documents.routes.js`.

O anexo precisa de uma nota já gravada, então ele aparece ao **editar** uma
nota; na nota nova o formulário avisa isso. Na lista, um 📎 com o número
mostra quantos arquivos a nota tem.

## Agendamento recorrente

No formulário de atendimento, a chave **"Repetir agendamento?"** abre as
opções de série. Enquanto ela estiver desligada, nenhum desses campos aparece
e o formulário continua curto.

**Frequências:** semanalmente, a cada 2 semanas, mensalmente, a cada 2 meses
e personalizado (a cada N semanas ou N meses).

**Onde a série para:** por uma data ("repetir até") **ou** por quantidade de
ocorrências. Um dos dois é obrigatório — sem limite o servidor geraria
ocorrências indefinidamente. O teto de segurança é 120 atendimentos por série.

**Dias da semana:** nas frequências contadas em semanas, é possível marcar os
dias (ex.: segunda e quarta). Em branco, a série repete sempre no mesmo dia
da semana da primeira data.

### Como as ocorrências são gravadas

Cada ocorrência é uma linha de verdade em `appointments` — não há
"visualização" calculada na hora de exibir. Todas as linhas criadas juntas
compartilham um `recurrence_group_id`, e é ele que permite depois alterar ou
cancelar a série inteira sem adivinhar quais linhas andam juntas.

### Conflito de horário na série

A regra de conflito vale para a recorrência inteira. A **primeira** data é a
que a profissional pediu explicitamente: se ela estiver ocupada, nada é
criado e o erro aparece na tela.

Para as datas seguintes, o sistema **nunca apaga o que já existe**. A
ocorrência que não cabe é pulada e a mensagem diz quais foram e por quê:

> Agendamento recorrente criado com sucesso. 2 atendimentos foram adicionados
> à agenda. Não foi possível criar 1 atendimento porque já existe outro
> agendamento no horário: 23/11/2026 às 17:30.

A profissional decide o que fazer com as que ficaram de fora.

### Fim de mês (comportamento escolhido)

Fevereiro não tem dia 31, então uma série mensal do dia 31 precisa de uma
regra. A escolhida: **encostar no último dia do mês quando o dia não existe,
e voltar ao dia de origem no mês seguinte que tiver**.

```
31/01 → 28/02 → 31/03 → 30/04 → 31/05
```

O cálculo parte sempre da data de origem, nunca da ocorrência anterior. Somar
de mês em mês faria 31/01 virar 28/02 e depois 28/03, arrastando a série
inteira para o dia errado. Em ano bissexto o encaixe é 29/02.

### Alterar ou cancelar uma série

Ao editar ou excluir um atendimento que faz parte de uma série, o sistema
**pergunta antes** — nada é aplicado aos outros por conta própria:

| Alcance | Editar | Cancelar |
|---|---|---|
| Somente este | altera só a ocorrência aberta | apaga só ela |
| Este e os próximos | altera desta data em diante | apaga desta data em diante |
| Toda a série | altera todas | apaga todas |

Em "este e os próximos" e "toda a série", o que muda é horário, tipo, status,
paciente e observação — a **data de cada ocorrência é preservada**, senão a
série inteira desabaria em um único dia.

### Horários

Hora de início e hora de término são campos livres (`step="60"`): qualquer
minuto vale — 17:01, 17:23, 17:47. Nada é arredondado. A hora de término é
sugerida a partir da duração padrão das Configurações e para de ser
recalculada assim que a profissional a edita à mão.

A validação exige término posterior ao início. Um atendimento não atravessa a
meia-noite: a data é uma coluna só, então a sugestão automática encosta em
23:59.

> **Fuso horário:** a data fica em uma coluna `DATE` e os horários em texto
> `"HH:MM"`. Nenhum dos dois passa por conversão de fuso, então 17:10
> continua 17:10 independentemente do fuso do servidor ou do navegador.

## Backup

**Backup do banco sozinho não basta.** Os arquivos (documentos de paciente e
anexos de nota, todos na mesma pasta) ficam fora dele, então um backup
completo tem duas partes que precisam ser copiadas **juntas**:

**1. O banco de dados**

```bash
pg_dump "$DATABASE_URL" -Fc -f agenda-$(date +%F).dump
```

**2. A pasta de arquivos** (o caminho de `UPLOAD_DIR`)

```bash
tar -czf agenda-arquivos-$(date +%F).tar.gz -C "$UPLOAD_DIR" .
```

Restaurar exige os dois na mesma data. Se você restaurar um banco antigo
sobre uma pasta de arquivos nova, os documentos enviados nesse meio-tempo
viram arquivos sem registro; no caminho inverso, ficam registros apontando
para arquivos que não existem mais (a tela mostra "o arquivo deste documento
não está mais disponível", sem quebrar).

Para conferir se banco e disco estão em sincronia:

```sql
SELECT storage_name FROM client_documents
UNION ALL
SELECT storage_name FROM note_documents
ORDER BY storage_name;
```

A lista deve bater com o conteúdo da pasta de uploads.

## Rodando os testes automatizados

Com o backend configurado (banco criado e migrado), rode:

```bash
cd backend
npm test
```

O que é testado automaticamente:

- login com PIN correto/incorreto e proteção das rotas sem sessão;
- criação, edição e exclusão de paciente (com validação de dados);
- criação de agendamento, cálculo do horário final pela duração;
- **conflito de horário** (recusa um segundo agendamento no mesmo horário);
- alteração de status (ex.: marcar como realizado);
- histórico do paciente refletindo o atendimento;
- exclusão de paciente removendo em cascata seus agendamentos;
- leitura/gravação das configurações;
- logout encerrando a sessão e troca de PIN derrubando sessões abertas;
- bloqueio por tentativas de PIN, inclusive contra IP forjado;
- comportamento em modo produção (cookie `Secure`, CORS fechado, CSP).

Sobre pacientes, saúde e documentos (`backend/tests/patients.test.js`):

- responsáveis, alergias e medicamentos: gravar, recarregar, editar,
  acrescentar um segundo e remover só o escolhido;
- "nenhuma alergia conhecida" limpando a lista e voltando a aceitá-la;
- envio de PDF, JPG e DOCX, com nome, tipo, tamanho e data corretos;
- recusa de formato não aceito e de arquivo acima de 10 MB;
- nome em disco gerado pelo servidor (o nome enviado não vira caminho);
- visualizar e baixar, com DOC/DOCX sempre em download;
- **documento de um paciente não abre pela URL de outro**;
- nenhuma rota de documento responde sem sessão;
- exclusão removendo o registro **e** o arquivo do disco;
- exclusão do paciente levando junto listas e arquivos;
- ausência de registros órfãos nas quatro tabelas novas.

Sobre notas (`backend/tests/notes.test.js`):

- criar, listar, editar e excluir, com a alteração conferida no banco;
- nota só com título é aceita; título vazio é recusado;
- excluir uma nota não afeta as outras;
- nenhuma rota de nota responde sem sessão.

Sobre anexos de nota (`backend/tests/note-documents.test.js`):

- envio de PDF e imagem, com acento no nome do arquivo preservado;
- contagem de anexos aparecendo na listagem de notas;
- nome em disco gerado pelo servidor e formato não aceito recusado;
- visualizar e baixar, com os cabeçalhos de segurança corretos;
- **anexo de uma nota não abre pela URL de outra**, nem pela rota de paciente;
- excluir o anexo apaga o registro **e** o arquivo do disco;
- excluir a nota leva anexos e arquivos junto, sem deixar órfãos.

Sobre horário livre e recorrência (`backend/tests/recurrence.test.js`):

- minutos avulsos (08:01, 09:17, 12:43, 14:32, 17:10, 18:59, 23:01) aceitos
  **sem arredondamento**, e hora de término preservada;
- término anterior ou igual ao início é recusado com a mensagem certa;
- geração das datas para todas as frequências, incluindo personalizada e
  seleção de dias da semana;
- **fim de mês** (31/01 → 28/02 → 31/03) e ano bissexto (29/02/2028);
- série atravessando a virada do ano;
- as ocorrências são gravadas de verdade, com o mesmo `recurrence_group_id`;
- conflito no meio da série **pula a ocorrência sem apagar o que existe**;
- conflito na primeira data não cria nada;
- editar "somente este", "este e os próximos" e "toda a série", sempre
  preservando a data de cada ocorrência;
- cancelar nos três alcances;
- atendimento avulso ignora o alcance e apaga só a si mesmo.

Também há testes unitários das funções de data/hora usadas para montar a
agenda (`backend/tests/time.test.js`).

Os testes de documento usam uma pasta temporária própria (`UPLOAD_DIR`),
apagada ao final — os arquivos reais nunca são tocados. Os de recorrência
usam datas em 2032/2033, que nunca esbarram em dados reais.

Além dos testes automatizados, o fluxo completo (login, agenda em dia/semana/
mês, criar/editar/cancelar agendamento, cadastro de paciente com responsável,
alergia e medicamento, envio/visualização/exclusão de documentos, criação e
edição de notas, série mensal com data final, série semanal por dias da
semana, conflito no meio da série, alcance de edição e cancelamento, sessão
expirada e responsividade em 390, 768, 1366 e 1920 px) foi verificado
manualmente no navegador.

## Deploy no Railway (caminho recomendado)

O projeto já vem pronto para o Railway: o `package.json` da raiz e o
`railway.json` cuidam de instalar tudo, compilar o frontend, aplicar as
migrations e subir o servidor. O backend serve o frontend compilado na mesma
origem, então **um único serviço** atende tudo.

1. Acesse [railway.app](https://railway.app) e entre com a conta do GitHub.
2. **New Project → Deploy from GitHub repo** e escolha o repositório
   `zek409080/SiteDuda`.
3. No mesmo projeto, clique em **+ New → Database → Add PostgreSQL**. O
   Railway cria o banco e a variável `DATABASE_URL` automaticamente.
4. Abra o serviço da aplicação → aba **Variables** e adicione:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referência ao banco criado) |
   | `SESSION_SECRET` | uma chave aleatória longa (veja o comando abaixo) |
   | `ACCESS_PIN` | o PIN inicial de acesso, ex.: `429173` |
   | `NODE_ENV` | `production` |
   | `UPLOAD_DIR` | `/data/uploads` (o volume do passo 5) |

   Para gerar o `SESSION_SECRET`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Não é preciso definir `PORT` — o Railway injeta sozinho.

5. **Crie um volume para os documentos.** No serviço da aplicação:
   **Settings → Volumes → New Volume**, com ponto de montagem `/data`.

   Sem isso, os arquivos enviados pela aba Documentos são apagados a cada
   deploy — o disco do container não sobrevive a uma nova publicação. O banco
   de dados não é afetado (ele vive no serviço do PostgreSQL), mas os
   registros ficariam apontando para arquivos que não existem mais.

6. Em **Settings → Networking**, clique em **Generate Domain**. O Railway
   devolve uma URL pública com HTTPS já configurado, do tipo
   `https://siteduda-production.up.railway.app`.
7. Abra a URL, digite o PIN e a agenda está no ar, acessível de qualquer
   celular ou computador.

A partir daí, todo `git push` para a branch `main` publica a nova versão
automaticamente.

> Os dados de teste (`npm run seed`) são para uso local. Em produção o banco
> começa vazio, com apenas a configuração inicial criada automaticamente.

> **Backup em produção:** o Railway faz backup do PostgreSQL, mas **não** do
> volume de arquivos. Baixe as duas partes juntas — veja [Backup](#backup).

## Deploy em outros provedores

Passos gerais (os detalhes variam conforme o provedor escolhido — Render,
um VPS próprio, etc.):

1. **Banco de dados:** crie um PostgreSQL gerenciado (Neon, Supabase,
   Railway, RDS...) e copie a `DATABASE_URL` de produção.
2. **Build do frontend:**
   ```bash
   cd frontend
   npm run build
   ```
   Isso gera `frontend/dist`. O backend detecta essa pasta automaticamente e
   passa a servir o frontend já compilado pela mesma origem da API —
   **não é preciso hospedar frontend e backend separadamente**.
3. **Variáveis de ambiente no servidor:** as mesmas do `.env`, com
   `NODE_ENV=production`, um `SESSION_SECRET` novo e forte, e
   `DATABASE_URL` apontando para o banco de produção.
4. **Migrations em produção:**
   ```bash
   cd backend
   npm run db:deploy
   ```
5. **Subir o servidor:**
   ```bash
   npm start
   ```
6. **HTTPS:** obrigatório em produção — use o certificado gratuito do próprio
   provedor (Railway/Render já entregam HTTPS) ou um proxy reverso (Nginx +
   Let's Encrypt) na frente do Node. Com `NODE_ENV=production`, o cookie de
   sessão passa a exigir conexão segura automaticamente.

## Segurança

**Acesso e sessão**

- PIN guardado com hash bcrypt, nunca em texto puro, e nunca devolvido pela API.
- Sessão em cookie `httpOnly` (JavaScript da página não consegue lê-lo),
  `SameSite=Lax` e `Secure` automático sob HTTPS.
- **Sessões são revogáveis de verdade.** Cada token carrega o número da
  geração da sessão, conferido a cada requisição. Sair do sistema ou trocar
  o PIN invalida na hora todos os cookies já emitidos, inclusive um que
  tivesse sido roubado. Quem troca o PIN continua conectada; os demais
  aparelhos caem.
- **Bloqueio progressivo por tentativas erradas**, gravado no banco: 1 minuto
  após 5 erros, 15 minutos após 10, 1 hora após 15. Como fica no banco e vale
  para o sistema inteiro, não é contornável trocando de IP nem reiniciando o
  servidor. Novos PINs exigem no mínimo 6 dígitos.
- Limite de requisições por IP no login e na API como um todo, como camada
  adicional.

**Dados e permissões**

- Todas as rotas de dados exigem sessão válida — a API nunca responde dados de
  pacientes ou agendamentos sem autenticação.
- Validação de toda entrada no backend com `zod`, cobrindo corpo, parâmetros e
  query string. A validação do formulário é só conveniência; quem decide é o
  servidor.
- Proteção contra mass assignment: campos desconhecidos são descartados e cada
  serviço monta os dados por lista explícita. Não há como injetar `id`,
  `createdAt` nem o hash do PIN por requisição.
- Respostas montadas por lista explícita de campos, então nenhum dado interno
  vaza por esquecimento.
- Consultas exclusivamente pelo Prisma, parametrizadas. Não há SQL escrito à
  mão em lugar nenhum, portanto não há superfície de SQL injection.
- Identificadores são UUIDs aleatórios, não sequenciais, e não é possível
  descobrir registros por tentativa.
- A aplicação pode rodar com um usuário de banco sem poderes administrativos.
  Veja [Usuário de banco restrito](#usuário-de-banco-restrito).

**Rede e navegador**

- `Content-Security-Policy` restritiva: nada de script inline, nada de `eval`,
  nada de origem externa, e a página não pode ser embutida em outro site.
- HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` e
  demais cabeçalhos via `helmet`.
- Em produção o CORS não autoriza nenhuma origem externa, já que o backend
  entrega o próprio frontend.
- Páginas marcadas com `noindex, nofollow` e `robots.txt` bloqueando buscadores.

Toda essa lista é coberta por testes automatizados. Rode `npm test` dentro de
`backend` para conferir.

## Usuário de banco restrito

Por padrão a aplicação conecta com o usuário dono do banco, que costuma ser
superusuário. Se essa credencial vazar, o estrago passa longe de só ler a
agenda. Para reduzir isso:

1. Abra `backend/prisma/least-privilege.sql`, troque a senha de exemplo por
   uma senha forte e rode o script conectado como administrador do banco.
2. No ambiente da aplicação, use duas variáveis:
   - `DATABASE_URL` apontando para o usuário restrito, usado o tempo todo;
   - `MIGRATION_DATABASE_URL` apontando para o administrador, usado apenas ao
     aplicar migrations.

O usuário restrito só consegue ler e escrever nas três tabelas da agenda. Ele
não cria nem apaga tabelas, não cria usuários e não é superusuário.

## Privacidade e LGPD

Este sistema guarda dados pessoais e observações de atendimento — informação
sensível pela natureza do trabalho da psicóloga. Alguns cuidados básicos:

- **Minimização:** o cadastro de paciente exige apenas nome e telefone. Todo
  o resto — e-mail, nascimento, endereço, responsáveis, alergias,
  medicamentos, documentos — é opcional e só é preenchido quando faz sentido
  para o acompanhamento. Não é coletado nenhum dado além do que aparece nos
  formulários.
- **Dados de saúde:** alergias e medicamentos são campos de registro do que a
  paciente ou o responsável informou. O sistema não interpreta, não sugere e
  não faz nenhuma verificação clínica em cima deles.
- **Finalidade:** os dados existem só para a organização da própria agenda
  da profissional — não há compartilhamento, exportação automática ou
  integração com terceiros.
- **Acesso restrito:** só quem tem o PIN acessa o sistema; não existe
  visualização pública de nenhuma tela.
- **Observações de sessão são privadas:** o campo de observações de cada
  atendimento nunca aparece fora da tela autenticada — não há relatório
  público, link compartilhável ou exportação para fora do sistema.
- **Notas são privadas:** o bloco de notas fica atrás da mesma autenticação
  do resto do sistema e não é compartilhado com ninguém.
- **Documentos não têm link público:** cada arquivo é entregue por uma rota
  que confere a sessão e a qual paciente ele pertence. Saber o endereço não
  basta, e o nome do arquivo em disco não revela nada sobre o paciente.
- **Nada de dado sensível na URL:** as telas identificam pacientes e
  documentos por identificadores aleatórios, nunca por nome ou telefone.
  O sistema também pede aos buscadores que não indexem nenhuma página
  (`X-Robots-Tag` e `robots.txt`).
- **Retenção e exclusão:** a profissional pode excluir um paciente a qualquer
  momento; isso remove em cascata o histórico de atendimentos, responsáveis,
  alergias, medicamentos e também os arquivos correspondentes no disco —
  importante para atender a um eventual pedido de exclusão de dados por parte
  do titular. Não fica resíduo nem no banco nem no armazenamento.
- **Backup:** os dados moram em duas partes — o banco PostgreSQL e a pasta de
  documentos. Backup do banco sozinho **não** é suficiente; veja
  [Backup](#backup) para o procedimento completo. Trate as cópias com o mesmo
  cuidado de acesso que o sistema em produção.
- **Não é aconselhamento jurídico:** esta seção descreve cuidados técnicos
  básicos de proteção de dados. Para uma avaliação de conformidade com a
  LGPD aplicada ao contexto profissional (prontuário psicológico, sigilo
  profissional do CFP, tempo de guarda de registros etc.), recomenda-se
  consultar orientação jurídica/profissional específica.

## O que este sistema propositalmente não faz

Por definição de escopo, a primeira versão **não inclui**: pagamentos,
financeiro, emissão de nota fiscal, integração com convênios, prontuário
médico completo, chat, mensagens, integração com WhatsApp ou e-mail
automático, múltiplos profissionais ou usuários, login de pacientes, planos
de assinatura, cobrança recorrente, relatórios complexos ou inteligência
artificial. A prioridade do projeto é **simplicidade e organização** para uso
pessoal de uma única profissional.
