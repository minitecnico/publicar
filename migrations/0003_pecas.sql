-- Peças (criativos) da campanha
-- A campanha é o contrato (período, telas, horários, espaço comprado = duração × inserções).
-- As peças giram dentro desse espaço: cada inserção exibe a próxima peça do rodízio.
CREATE TABLE IF NOT EXISTS pecas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   TEXT NOT NULL,
  campanha_id INTEGER NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  nome        TEXT,
  midia_tipo  TEXT NOT NULL DEFAULT 'imagem', -- imagem | video | youtube
  midia_url   TEXT,
  duracao     INTEGER,                        -- segundos; vídeo = duração real (não pode passar do espaço)
  texto       TEXT,                           -- chamada sobre a peça
  link_qr     TEXT,                           -- vazio = usa o link da campanha
  peso        INTEGER NOT NULL DEFAULT 1,     -- rodízio por peso (ex.: 3 = aparece 3× mais)
  inicio      TEXT,                           -- período próprio da peça (opcional)
  fim         TEXT,
  status      TEXT NOT NULL DEFAULT 'aguardando', -- aguardando | aprovada | reprovada | pausada
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pecas_campanha ON pecas(campanha_id, ordem);
CREATE INDEX IF NOT EXISTS idx_pecas_tenant ON pecas(tenant_id);

-- Rodízio das peças: sequencial (todas iguais) | peso
ALTER TABLE campanhas ADD COLUMN rotacao TEXT NOT NULL DEFAULT 'sequencial';

-- Prova de exibição por peça: {"<peca_id>": total} dentro da linha agregada campanha/tela/dia
ALTER TABLE exibicoes ADD COLUMN pecas TEXT NOT NULL DEFAULT '{}';

-- Migra a mídia única de cada campanha existente para a sua primeira peça (já aprovada se a campanha estava no ar)
INSERT INTO pecas (tenant_id, campanha_id, nome, midia_tipo, midia_url, duracao, texto, status, ordem)
SELECT tenant_id, id, nome, midia_tipo, midia_url, duracao, texto,
       CASE WHEN status IN ('ativa', 'pausada', 'encerrada') THEN 'aprovada' ELSE 'aguardando' END, 0
  FROM campanhas
 WHERE midia_url IS NOT NULL AND midia_url <> '';
