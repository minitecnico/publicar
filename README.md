# Publicar — o seu outdoor itinerante

Plataforma de mídia local: painel administrativo + player para tablets em carros de aplicativo e TVs em estabelecimentos.
Roda 100% na Cloudflare, no plano gratuito. Deploy automático pelo GitHub Actions.

- **Painel:** `https://publicar1.pages.dev`
- **Player das telas:** `https://publicar1.pages.dev/tela` (ou `/tela/CODIGO`)

## O que já vem pronto

| Módulo | O que faz |
| --- | --- |
| Painel | Exibições do dia, telas online, receita recorrente, a receber, pendências |
| Campanhas | Contrato do anunciante: espaço comprado (duração × inserções), período, dias e faixas de horário, telas, QR code, aprovação, prévia de disponibilidade |
| Peças (criativos) | Várias por campanha, envio múltiplo, rodízio sequencial ou por peso, chamada/QR/período próprios, aprovação por peça, checagem de formato e duração, prova de exibição por peça |
| Inventário | Mapa tela × hora com o quanto do ciclo de anúncios já está vendido, espaços livres e horário de pico |
| Clientes | Anunciantes e estabelecimentos, plano, mensalidade, vencimento, módulos ativos por cliente |
| Telas | Cadastro de tablets e TVs com código de 6 letras, QR de instalação, status online, layout, cores, faixa de recados, entretenimento |
| Motoristas | Cadastro, Pix, veículo, nível (bronze/prata/ouro), repasse fixo |
| Financeiro | Resultado do mês, lançamentos de despesas/entradas, repasses aos motoristas |
| Cobrança | Gera as faturas do mês, lembrete por WhatsApp com mensagem pronta e Pix, baixa de pagamento |
| Relatórios | Prova de exibição por campanha, por dia e por tela, leituras de QR code, impressão em PDF |
| Configurações | Dados da empresa, chave Pix, modelo de mensagem, módulos ligados/desligados, usuários |
| Player | Tela cheia ou layout lateral, funciona offline (guarda mídia e programação), relógio, faixa de recados, QR code, prova de exibição, sinal de vida a cada 5 min |

## Arquitetura (tudo Cloudflare, plano grátis)

```
GitHub (push na main) ──► GitHub Actions ──► Cloudflare Pages "publicar1"
                                              ├─ dist/            Vue 3 + Vite (painel e player)
                                              ├─ functions/api/   Pages Functions + Hono (API /api/*)
                                              ├─ D1  publicar-db  banco SQLite (migrations/)
                                              └─ KV  publicar-media  mídias (até 25 MB por arquivo)
```

| Serviço | Uso | Limite grátis |
| --- | --- | --- |
| Pages | Site estático | Banda ilimitada, 500 builds/mês |
| Pages Functions (Workers) | API | 100 mil requisições/dia |
| D1 | Banco de dados | 5 GB, 5 milhões de leituras e 100 mil gravações por dia |
| KV | Mídias das campanhas | 1 GB, 1.000 gravações/dia, 25 MB por arquivo |
| R2 (opcional) | Mídias grandes | 10 GB — **exige cartão cadastrado** na Cloudflare |

Os limites que importam no plano grátis são **100 mil requisições** e **100 mil linhas gravadas no D1** por dia,
somando todas as telas. Para caber neles:

- A tela busca a programação a cada **15 min**, e essa mesma busca é o **sinal de vida** (1 gravação). São ~96 requisições
  e ~96 gravações por tela por dia. Tela "online" = deu sinal nos últimos 25 min.
- A prova de exibição fica acumulada no aparelho e é enviada num **intervalo adaptativo**: o servidor calcula
  `telas × campanhas × envios/dia ≤ 40 mil gravações` e informa a cada tela (mínimo 30 min, máximo 4 h).
  Nada se perde: se a tela ficar sem internet, envia tudo quando voltar.

| Rede | Intervalo de envio | Requisições/dia | Gravações/dia |
| --- | --- | --- | --- |
| 50 telas, 10 campanhas | 30 min | ~7 mil | ~29 mil |
| 180 telas, 10 campanhas | 65 min | ~21 mil | ~57 mil |
| 400 telas, 10 campanhas | 2,4 h | ~42 mil | ~78 mil |

Acima de ~450 telas, o Workers Paid (US$ 5/mês) amplia os limites para milhões. Uma campanha aprovada chega às telas
em até 15 minutos (ou na hora, ao recarregar o player). O painel "Exibições hoje" pode atrasar até o próximo envio.

## Colocar no ar (uma vez só)

1. **GitHub:** crie um repositório (ex.: `publicar`) e envie este código para a branch `main`.
2. **Cloudflare:** crie uma conta grátis em cloudflare.com.
   - Copie o **Account ID** (aparece na página inicial do painel, à direita).
   - Em *My Profile → API Tokens → Create Token*, use o modelo **Edit Cloudflare Workers** e acrescente as permissões
     de conta **Cloudflare Pages: Edit** e **D1: Edit** (o modelo já traz Workers KV Storage).
3. **GitHub → Settings → Secrets and variables → Actions:**
   - Secret `CLOUDFLARE_API_TOKEN` = o token criado
   - Secret `CLOUDFLARE_ACCOUNT_ID` = o Account ID
   - (opcional) Secret `APP_SECRET` = uma frase longa aleatória para assinar as sessões
   - (opcional) Variable `PAGES_PROJECT` = outro nome, se `publicar1` já estiver em uso na Cloudflare
   - (opcional) Variable `USE_R2` = `true` para guardar mídias no R2 (precisa de cartão cadastrado)
4. Faça um push na `main` (ou rode o workflow manualmente em *Actions → Deploy Publicar → Run workflow*).
   O workflow cria sozinho o banco D1, o KV e o projeto Pages, aplica as migrations e publica.
5. Abra `https://publicar1.pages.dev` e crie a conta de administrador no primeiro acesso.

> O endereço `publicar1.pages.dev` só é garantido se o nome estiver livre na Cloudflare. Se outra conta já usa,
> a Cloudflare acrescenta um sufixo (ex.: `publicar1-3xk.pages.dev`) — o link certo aparece no resumo do Actions.
> Endereços `*.workers.dev` sempre levam o subdomínio da conta (`publicar.SUACONTA.workers.dev`), por isso o
> projeto usa Pages.

## Inventário (share of voice)

Cada tela vende um **ciclo de anúncios** (padrão 120 s, ajustável em *Configurações*). Uma campanha ocupa
`duração × inserções` segundos do ciclo em cada tela e hora em que roda (ex.: 15 s × 1 = 1/8 do ciclo ≈ 30 exibições/hora).

- Ao salvar ou aprovar, o sistema **recusa** a campanha se ela não couber em alguma tela/hora (campanhas ativas,
  pausadas e aguardando aprovação reservam espaço; rascunho e encerrada, não). Pausar nunca é bloqueado.
- **Dias da semana e faixas de horário** (ex.: Seg–Sex 06:00–11:00) permitem vender o mesmo espaço para
  anunciantes diferentes em horários diferentes. O player confere o horário localmente, então funciona offline.
- A sobra do ciclo é preenchida com o entretenimento da tela; ciclo lotado = só anúncios.
- A página **Inventário** mostra a ocupação por tela e hora de um dia, para o vendedor saber o que ainda pode vender.

## Campanhas e peças

Como nas redes de DOOH, a **campanha** é o que foi vendido (espaço de N segundos × inserções, período, telas, horários)
e as **peças** são os criativos que giram dentro desse espaço. Trocar ou adicionar peça não muda o inventário.

- **Rodízio:** sequencial (todas iguais, na ordem) ou por peso (ex.: oferta peso 7, marca peso 3 = 70%/30%).
  O player usa round-robin ponderado suave, que distribui de forma uniforme mesmo com poucos ciclos.
- **Aprovação por peça:** peça nova ou com arquivo trocado volta para "aguardando" e só vai ao ar aprovada.
  Aprovar a campanha aprova junto as peças pendentes.
- **Formato padrão 16:9 (1920×1080):** toda imagem é padronizada no envio. Já em 16:9 → só redimensiona; fora do
  formato → abre o enquadramento (*Recortar* com arrastar/zoom, ou *Encaixar inteira* com fundo desfocado) e o arquivo
  final sai em 1920×1080. No player a moldura é sempre 16:9, então a peça encaixa exata e **nunca é cortada na tela**.
  Peças antigas fora do padrão têm o botão "Enquadrar em 1920×1080".
- **Regras técnicas:** imagem fica o espaço inteiro; vídeo precisa caber no espaço (a duração é lida do arquivo
  no envio) e deve ser exportado em 16:9. O painel avisa sobre resolução abaixo de 1920×1080.
- **Período e QR por peça:** ex.: peça "Promo de sexta" só às sextas da campanha; cada peça pode levar a um link.
- **Relatório:** exibições por peça e share real de cada criativo.

## Audiência estimada (impactos, alcance, CPM)

Anunciante e agência compram **pessoas impactadas**, não exibições. Cada tela tem seus números de audiência
(vazios usam os padrões de *Configurações*):

- **Carro:** corridas por dia × passageiros por corrida, duração média da corrida, horas rodando.
- **Estabelecimento:** pessoas por dia no local, tempo médio de espera, horas aberto.

| Métrica | Conta |
| --- | --- |
| Público no momento | pessoas/dia ÷ horas ligada × minutos diante da tela |
| Impactos | exibições × público no momento × visibilidade (carro 0,9 · estabelecimento 0,5) |
| Alcance | pessoas com ao menos uma oportunidade de ver (por tela e dia) |
| Frequência | impactos ÷ alcance |
| CPM | investimento no período ÷ impactos × 1.000 (campanha com "Valor investido") |

O relatório da campanha mostra esses números, por dia e por tela, e explica a metodologia (transparência para a agência).

## Instalar uma tela

1. No painel, **Telas → Nova tela**.
2. Clique em **Instalar** e leia o QR code com o tablet (ou abra `/tela` e digite o código).
3. No Chrome do tablet, *Adicionar à tela inicial* para abrir em tela cheia. Toque uma vez para liberar som e tela cheia.
4. Para tablets dedicados, use um app de quiosque (ex.: Fully Kiosk Browser) apontando para o endereço da tela.

## Desenvolvimento local

```bash
npm install
npm run db:migrate:local   # cria o D1 local em .wrangler/
npm run build              # gera dist/
npm run dev:api            # API + D1 + KV locais em http://localhost:8788
npm run dev                # (outro terminal) front com hot reload em http://localhost:5173
```

## Estrutura

```
src/                 front-end Vue 3
  views/             telas do painel e Player.vue
  components/        CrudPage (CRUD genérico), Modal, MediaInput, ConteudoEditor…
server/              API (Hono): auth, crud genérico, mídia, player, relatórios, cobrança
functions/api/       ponto de entrada das Pages Functions
migrations/          esquema do D1
scripts/provision.mjs  cria D1/KV/Pages se faltarem e gera o wrangler.toml no CI
.github/workflows/   deploy.yml
```

Para criar um módulo novo: uma tabela em `migrations/`, uma entrada em `server/crud.ts` (`RECURSOS`) e uma tela
usando `CrudPage` com a lista de campos.

## Próximos passos sugeridos

- Integração com Asaas (Pix Automático e boleto) na Cobrança
- Módulo de fila de atendimento em tempo real para barbearias
- Geofence por bairro usando o GPS do tablet
- Portal do anunciante (autoatendimento)
