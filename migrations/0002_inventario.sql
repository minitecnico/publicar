-- Inventário e segmentação por horário
-- dias_semana: [] = todos os dias; senão lista de 0 (domingo) a 6 (sábado)
-- horarios:    [] = o dia todo;    senão lista de janelas [{"ini":"06:00","fim":"10:00"}] (fim < ini cruza a meia-noite)
ALTER TABLE campanhas ADD COLUMN dias_semana TEXT NOT NULL DEFAULT '[]';
ALTER TABLE campanhas ADD COLUMN horarios TEXT NOT NULL DEFAULT '[]';
