-- Enquadramento da peça na tela:
--   preencher = ocupa a tela inteira (redimensiona e corta o excesso pelas bordas)
--   inteira   = mostra a peça inteira, sem cortar (sobra preenchida com o fundo desfocado)
ALTER TABLE pecas ADD COLUMN ajuste TEXT NOT NULL DEFAULT 'preencher';
