-- Pacotes comerciais prontos (ex.: Bairro, Cidade, Horário nobre)
CREATE TABLE IF NOT EXISTS pacotes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   TEXT NOT NULL,
  nome        TEXT NOT NULL,
  descricao   TEXT,
  tipo_tela   TEXT NOT NULL DEFAULT 'todas',  -- todas | carro | estabelecimento
  bairros     TEXT NOT NULL DEFAULT '[]',     -- [] = todos os bairros
  duracao     INTEGER NOT NULL DEFAULT 15,    -- segundos do espaço
  prioridade  INTEGER NOT NULL DEFAULT 1,     -- inserções por ciclo
  dias_semana TEXT NOT NULL DEFAULT '[]',
  horarios    TEXT NOT NULL DEFAULT '[]',
  preco_base  REAL NOT NULL DEFAULT 0,        -- R$ por mês
  dinamico    INTEGER NOT NULL DEFAULT 1,     -- 1 = preço sobe com a ocupação (até +50%)
  status      TEXT NOT NULL DEFAULT 'ativo',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pacotes_tenant ON pacotes(tenant_id);
