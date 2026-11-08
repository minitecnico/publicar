-- Alerta de tela offline: quando foi avisado (NULL = sem alerta pendente)
ALTER TABLE telas ADD COLUMN alerta_offline_em TEXT;

-- Minutos em que cada tela esteve de fato exibindo (tela visível), por dia: base do repasse por hora
CREATE TABLE IF NOT EXISTS atividade (
  tela_id INTEGER NOT NULL,
  dia     TEXT NOT NULL,
  minutos INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tela_id, dia)
) WITHOUT ROWID;

-- Repasse do motorista: fixo (como antes) ou por hora de tela ligada
ALTER TABLE motoristas ADD COLUMN modelo_repasse TEXT NOT NULL DEFAULT 'fixo'; -- fixo | hora
ALTER TABLE motoristas ADD COLUMN valor_hora REAL;
