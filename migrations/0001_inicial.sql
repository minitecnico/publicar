-- Publicar — esquema inicial (Cloudflare D1 / SQLite)
-- Todas as tabelas de negócio têm tenant_id: o sistema já nasce multi-cliente.

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenants (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL,
  modulos    TEXT NOT NULL DEFAULT '["mobilidade","estabelecimentos","financeiro","cobranca"]',
  config     TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usuarios (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id),
  nome       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel      TEXT NOT NULL DEFAULT 'operador', -- admin | operador
  ativo      INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clientes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id      TEXT NOT NULL,
  tipo           TEXT NOT NULL DEFAULT 'anunciante', -- anunciante | estabelecimento | ambos
  nome           TEXT NOT NULL,
  documento      TEXT,
  contato        TEXT,
  telefone       TEXT,
  email          TEXT,
  endereco       TEXT,
  bairro         TEXT,
  cidade         TEXT,
  segmento       TEXT,
  plano          TEXT,
  valor_mensal   REAL NOT NULL DEFAULT 0,
  dia_vencimento INTEGER NOT NULL DEFAULT 10,
  modulos        TEXT NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'ativo', -- ativo | pausado | cancelado
  observacoes    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant ON clientes(tenant_id);

CREATE TABLE IF NOT EXISTS motoristas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id    TEXT NOT NULL,
  nome         TEXT NOT NULL,
  cpf          TEXT,
  telefone     TEXT,
  pix          TEXT,
  veiculo      TEXT,
  placa        TEXT,
  apps         TEXT,
  repasse_fixo REAL NOT NULL DEFAULT 60,
  nivel        TEXT NOT NULL DEFAULT 'bronze',
  status       TEXT NOT NULL DEFAULT 'ativo',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_motoristas_tenant ON motoristas(tenant_id);

CREATE TABLE IF NOT EXISTS telas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id    TEXT NOT NULL,
  nome         TEXT NOT NULL,
  codigo       TEXT NOT NULL UNIQUE,
  tipo         TEXT NOT NULL DEFAULT 'carro', -- carro | estabelecimento
  cliente_id   INTEGER,                        -- estabelecimento dono da tela
  motorista_id INTEGER,                        -- motorista do carro
  bairro       TEXT,
  layout       TEXT NOT NULL DEFAULT 'cheia',  -- cheia | lateral
  cor_primaria TEXT NOT NULL DEFAULT '#F2A33A',
  cor_fundo    TEXT NOT NULL DEFAULT '#1F1F1F',
  logo_url     TEXT,
  ticker       TEXT,
  conteudo     TEXT NOT NULL DEFAULT '[]',     -- entretenimento: [{tipo,url,duracao,titulo}]
  status       TEXT NOT NULL DEFAULT 'ativa',
  ultimo_ping  TEXT,
  ultima_info  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_telas_tenant ON telas(tenant_id);

CREATE TABLE IF NOT EXISTS campanhas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   TEXT NOT NULL,
  cliente_id  INTEGER,
  nome        TEXT NOT NULL,
  midia_tipo  TEXT NOT NULL DEFAULT 'imagem', -- imagem | video | youtube
  midia_url   TEXT,
  duracao     INTEGER NOT NULL DEFAULT 15,    -- segundos (imagem/youtube)
  link_qr     TEXT,
  texto       TEXT,
  inicio      TEXT,
  fim         TEXT,
  tipo_tela   TEXT NOT NULL DEFAULT 'todas',  -- todas | carro | estabelecimento
  telas_alvo  TEXT NOT NULL DEFAULT '[]',     -- [] = todas do tipo; senão lista de ids
  prioridade  INTEGER NOT NULL DEFAULT 1,     -- repetições por loop
  status      TEXT NOT NULL DEFAULT 'aguardando', -- rascunho | aguardando | ativa | pausada | encerrada
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_campanhas_tenant ON campanhas(tenant_id, status);

CREATE TABLE IF NOT EXISTS faturas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       TEXT NOT NULL,
  cliente_id      INTEGER NOT NULL,
  descricao       TEXT,
  competencia     TEXT,                 -- AAAA-MM
  valor           REAL NOT NULL DEFAULT 0,
  vencimento      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'aberta', -- aberta | paga | cancelada
  pago_em         TEXT,
  forma_pagamento TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_faturas_tenant ON faturas(tenant_id, status, vencimento);
CREATE UNIQUE INDEX IF NOT EXISTS idx_faturas_comp ON faturas(tenant_id, cliente_id, competencia);

CREATE TABLE IF NOT EXISTS lancamentos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id  TEXT NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'saida', -- entrada | saida
  categoria  TEXT,
  descricao  TEXT,
  valor      REAL NOT NULL DEFAULT 0,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lanc_tenant ON lancamentos(tenant_id, data);

-- Prova de exibição agregada por dia (uma linha por campanha/tela/dia: economiza gravações no D1)
CREATE TABLE IF NOT EXISTS exibicoes (
  tenant_id   TEXT NOT NULL,
  campanha_id INTEGER NOT NULL,
  tela_id     INTEGER NOT NULL,
  dia         TEXT NOT NULL,
  total       INTEGER NOT NULL DEFAULT 0,
  qr          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (campanha_id, tela_id, dia)
);
CREATE INDEX IF NOT EXISTS idx_exib_tenant ON exibicoes(tenant_id, dia);
