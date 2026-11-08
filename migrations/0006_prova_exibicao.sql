-- Prova de exibição por hora: {"<0-23>": total} dentro da linha agregada campanha/tela/dia
ALTER TABLE exibicoes ADD COLUMN horas TEXT NOT NULL DEFAULT '{}';

-- Relatório público da campanha (link sem login para o anunciante acompanhar ao vivo)
ALTER TABLE campanhas ADD COLUMN token_publico TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_campanhas_token ON campanhas(token_publico);
