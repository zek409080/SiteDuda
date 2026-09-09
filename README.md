# Minha Agenda

Agenda digital pessoal para uma psicóloga organizar seus próprios atendimentos:
visualizar a agenda por dia, semana ou mês, cadastrar clientes, criar e editar
agendamentos, marcar status (agendado, confirmado, realizado, cancelado,
faltou) e guardar observações privadas de cada sessão.

Feita para **uma única pessoa**. Não há cadastro de usuários, múltiplos
perfis, portal do paciente ou qualquer coisa parecida com um sistema de
clínica — só uma agenda simples, protegida por PIN.

## Sumário

- [Stack utilizada](#stack-utilizada)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Instalação passo a passo](#instalação-passo-a-passo)
- [Configurar o PIN de acesso](#configurar-o-pin-de-acesso)
- [Dados de teste](#dados-de-teste)
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

## Estrutura do projeto

```
SiteDuda/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # tabelas: clients, appointments, settings
│   │   ├── migrations/
│   │   └── seed.js            # dados fictícios para teste
│   ├── src/
│   │   ├── config/            # variáveis de ambiente
│   │   ├── lib/                # cliente do Prisma
│   │   ├── middlewares/        # autenticação, validação, erros
│   │   ├── routes/             # endpoints HTTP + validações (zod)
│   │   ├── services/           # regras de negócio (conflito de horário, etc.)
│   │   ├── app.js
│   │   └── server.js
│   └── tests/                  # testes automatizados (node --test)
└── frontend/
    └── src/
        ├── components/         # Layout, modais, formulários
        ├── pages/               # Agenda, Clientes, Detalhe do cliente, Configurações, Login
        ├── services/api.js     # único ponto de contato com a API
        └── lib/                 # datas, status, autenticação (contexto React)
```

O frontend **nunca** acessa o banco diretamente — toda a comunicação passa
pela API (`frontend → API → backend → PostgreSQL`).

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

Para popular o banco com 5 clientes fictícios e alguns agendamentos de
exemplo (útil para testar o sistema antes do uso real):

```bash
cd backend
npm run seed
```

O script não roda se já existir algum cliente cadastrado, para nunca
sobrescrever dados reais sem querer. Para remover **todos** os clientes e
agendamentos (dados de teste inclusive) e recomeçar do zero:

```bash
npm run seed:clear
```

⚠️ `seed:clear` apaga todos os clientes e agendamentos do banco — não use em
um banco com dados reais de atendimentos.

## Rodando os testes automatizados

Com o backend configurado (banco criado e migrado), rode:

```bash
cd backend
npm test
```

O que é testado automaticamente:

- login com PIN correto/incorreto e proteção das rotas sem sessão;
- criação, edição e exclusão de cliente (com validação de dados);
- criação de agendamento, cálculo do horário final pela duração;
- **conflito de horário** (recusa um segundo agendamento no mesmo horário);
- alteração de status (ex.: marcar como realizado);
- histórico do cliente refletindo o atendimento;
- exclusão de cliente removendo em cascata seus agendamentos;
- leitura/gravação das configurações;
- logout encerrando a sessão.

Também há testes unitários das funções de data/hora usadas para montar a
agenda (`backend/tests/time.test.js`).

Além dos testes automatizados, o fluxo completo (login, agenda em dia/semana/
mês, criar/editar/cancelar agendamento, cadastro e busca de clientes,
responsividade no celular) foi verificado manualmente no navegador durante o
desenvolvimento.

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
   | `ACCESS_PIN` | o PIN inicial de acesso, ex.: `4291` |
   | `NODE_ENV` | `production` |

   Para gerar o `SESSION_SECRET`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Não é preciso definir `PORT` — o Railway injeta sozinho.

5. Em **Settings → Networking**, clique em **Generate Domain**. O Railway
   devolve uma URL pública com HTTPS já configurado, do tipo
   `https://siteduda-production.up.railway.app`.
6. Abra a URL, digite o PIN e a agenda está no ar, acessível de qualquer
   celular ou computador.

A partir daí, todo `git push` para a branch `main` publica a nova versão
automaticamente.

> Os dados de teste (`npm run seed`) são para uso local. Em produção o banco
> começa vazio, com apenas a configuração inicial criada automaticamente.

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

- Acesso protegido por PIN (hash bcrypt, nunca gravado em texto puro).
- Sessão via cookie `httpOnly` (inacessível a JavaScript no navegador),
  assinado com JWT e com expiração configurável.
- Todas as rotas de dados exigem sessão válida — a API nunca responde dados
  de clientes ou agendamentos sem autenticação.
- Limite de tentativas de login (10 por 10 minutos) para dificultar tentativa
  de adivinhar o PIN.
- Validação de todos os dados de entrada no backend (biblioteca `zod`), tanto
  na API quanto reforçada no formulário do frontend.
- Consultas ao banco feitas exclusivamente pelo Prisma, que usa consultas
  parametrizadas — sem concatenar SQL, sem risco de SQL Injection.
- Nenhum identificador de cliente ou agendamento trafega por URL de forma
  sensível (os IDs são UUIDs aleatórios, não sequenciais).
- Cabeçalhos de segurança HTTP via `helmet`.
- Páginas marcadas com `noindex, nofollow` e `robots.txt` bloqueando
  qualquer indexação por buscadores.

## Privacidade e LGPD

Este sistema guarda dados pessoais e observações de atendimento — informação
sensível pela natureza do trabalho da psicóloga. Alguns cuidados básicos:

- **Minimização:** o cadastro de cliente pede apenas o essencial (nome,
  telefone; e-mail e nascimento são opcionais). Não é coletado nenhum dado
  além do que aparece nos formulários.
- **Finalidade:** os dados existem só para a organização da própria agenda
  da profissional — não há compartilhamento, exportação automática ou
  integração com terceiros.
- **Acesso restrito:** só quem tem o PIN acessa o sistema; não existe
  visualização pública de nenhuma tela.
- **Observações de sessão são privadas:** o campo de observações de cada
  atendimento nunca aparece fora da tela autenticada — não há relatório
  público, link compartilhável ou exportação para fora do sistema.
- **Retenção e exclusão:** a profissional pode excluir um cliente a qualquer
  momento; isso remove também, em cascata, todo o histórico de atendimentos
  associado a ele — importante para atender a um eventual pedido de exclusão
  de dados por parte do titular.
- **Backup:** como os dados moram em um banco PostgreSQL real, é
  responsabilidade de quem hospeda o sistema manter backups periódicos do
  banco (a maioria dos provedores gerenciados já faz isso automaticamente).
  Trate os backups com o mesmo cuidado de acesso que o banco principal.
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
