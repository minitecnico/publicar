-- Portal do anunciante: link exclusivo por cliente (sem senha, revogável)
ALTER TABLE clientes ADD COLUMN token_portal TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_token_portal ON clientes(token_portal);

-- De onde veio a peça: painel (operador) ou portal (o próprio anunciante enviou)
ALTER TABLE pecas ADD COLUMN origem TEXT NOT NULL DEFAULT 'painel';
