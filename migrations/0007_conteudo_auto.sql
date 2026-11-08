-- Quadros de conteúdo automático por tela (clima, cotacao, noticias, esportes, curiosidades)
ALTER TABLE telas ADD COLUMN widgets TEXT NOT NULL DEFAULT '["clima","cotacao","noticias","esportes","curiosidades"]';
