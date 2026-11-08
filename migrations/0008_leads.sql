-- QR por hora: {"<0-23>": leituras} na linha agregada campanha/tela/dia
ALTER TABLE exibicoes ADD COLUMN qr_horas TEXT NOT NULL DEFAULT '{}';

-- Atribuição: WhatsApp do anunciante e cupom único por leitura do QR
ALTER TABLE campanhas ADD COLUMN whatsapp TEXT;                         -- número do anunciante (só dígitos)
ALTER TABLE campanhas ADD COLUMN whatsapp_msg TEXT;                     -- mensagem pronta
ALTER TABLE campanhas ADD COLUMN cupom_oferta TEXT;                     -- ex.: "10% de desconto" (vazio = sem cupom)
ALTER TABLE campanhas ADD COLUMN cupom_validade INTEGER NOT NULL DEFAULT 7; -- dias
ALTER TABLE campanhas ADD COLUMN token_loja TEXT;                       -- link da loja para validar cupons
CREATE UNIQUE INDEX IF NOT EXISTS idx_campanhas_token_loja ON campanhas(token_loja);

CREATE TABLE IF NOT EXISTS cupons (
  codigo      TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  campanha_id INTEGER NOT NULL,
  tela_id     INTEGER,
  peca_id     INTEGER,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now')),
  expira_em   TEXT NOT NULL,          -- AAAA-MM-DD (último dia válido)
  usado_em    TEXT,
  valor_venda REAL
);
CREATE INDEX IF NOT EXISTS idx_cupons_campanha ON cupons(campanha_id, criado_em);
