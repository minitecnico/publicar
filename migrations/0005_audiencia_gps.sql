-- Audiência estimada (parâmetros por tela; vazio = padrão da empresa em Configurações)
ALTER TABLE telas ADD COLUMN corridas_dia REAL;          -- carro: corridas por dia
ALTER TABLE telas ADD COLUMN passageiros_corrida REAL;   -- carro: passageiros por corrida
ALTER TABLE telas ADD COLUMN fluxo_dia REAL;             -- estabelecimento: pessoas por dia no ambiente
ALTER TABLE telas ADD COLUMN permanencia_min REAL;       -- minutos que cada pessoa fica diante da tela
ALTER TABLE telas ADD COLUMN horas_operacao REAL;        -- horas por dia em que a tela fica ligada
ALTER TABLE telas ADD COLUMN local TEXT;                 -- posição fixa (estabelecimento): {"lat":..,"lng":..}

-- Campanha: valor investido (para CPM) e cerca geográfica
ALTER TABLE campanhas ADD COLUMN valor REAL;             -- R$ do contrato no período da campanha (sem datas = mensal)
ALTER TABLE campanhas ADD COLUMN geo TEXT;               -- {"lat":..,"lng":..,"raio_km":..} = só exibe dentro do raio

-- Trajeto dos carros, agregado por quadrícula de ~1 km (0,01°) e dia: minutos que a tela passou ali.
-- WITHOUT ROWID: a chave primária é a própria tabela (metade das gravações no D1).
CREATE TABLE IF NOT EXISTS trajetos (
  tela_id INTEGER NOT NULL,
  dia     TEXT NOT NULL,
  lat_i   INTEGER NOT NULL, -- latitude × 100, arredondada
  lng_i   INTEGER NOT NULL, -- longitude × 100, arredondada
  minutos INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tela_id, dia, lat_i, lng_i)
) WITHOUT ROWID;
