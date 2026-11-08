import { Hono, type Context } from 'hono'
import { cicloDoTenant, lista, type Janela } from './grade'
import { hoje, type AppEnv } from './types'

/** Rotas públicas usadas pelas telas (tablets e TVs). Identificação pelo código da tela. */
export const player = new Hono<AppEnv>()

/*
 * Orçamento do plano grátis da Cloudflare (por dia, somando TODAS as telas):
 *   - 100 mil requisições aos Workers/Functions
 *   - 100 mil linhas gravadas no D1
 * Cada tela: busca a programação a cada 15 min (e esse GET também é o sinal de vida: 1 gravação)
 * e envia a prova de exibição num intervalo adaptativo, calculado para a rede inteira caber no orçamento.
 */
export const PROGRAMACAO_MIN = 15
/** Gravações/dia reservadas para a prova de exibição (o resto fica para sinal de vida e para o painel). */
const ORCAMENTO_EXIBICOES = 40000

/** Intervalo (min) de envio das exibições: telas × campanhas × envios/dia ≤ orçamento. Entre 30 min e 4 h. */
export function intervaloExibicoes(telasAtivas: number, campanhasDaTela: number) {
  const min = Math.ceil((Math.max(1, telasAtivas) * Math.max(1, campanhasDaTela) * 1440) / ORCAMENTO_EXIBICOES)
  return Math.min(240, Math.max(30, min))
}

interface Tela {
  id: number
  tenant_id: string
  nome: string
  codigo: string
  tipo: string
  bairro: string | null
  layout: string
  cor_primaria: string
  cor_fundo: string
  logo_url: string | null
  ticker: string | null
  conteudo: string
  status: string
}

async function buscarTela(db: D1Database, codigo: string) {
  return db.prepare('SELECT * FROM telas WHERE codigo = ?').bind(codigo.toUpperCase()).first<Tela>()
}

player.get('/:codigo', async (c) => {
  const tela = await buscarTela(c.env.DB, c.req.param('codigo'))
  if (!tela) return c.json({ erro: 'Tela não encontrada. Confira o código no painel.' }, 404)
  if (tela.status !== 'ativa') return c.json({ erro: 'Tela desativada no painel.' }, 403)

  const dia = hoje()
  // sinal de vida junto com a busca da programação (economiza uma requisição e metade das gravações)
  const info = JSON.stringify({ versao: c.req.query('v') || null, tela: c.req.query('r') || null }).slice(0, 500)
  const [, contagem] = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE telas SET ultimo_ping = datetime('now'), ultima_info = ? WHERE id = ?").bind(info, tela.id),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM telas WHERE status = 'ativa'"),
  ])
  const telasAtivas = Number((contagem.results[0] as { n: number } | undefined)?.n) || 1
  const { results } = await c.env.DB.prepare(
    `SELECT id, nome, duracao, link_qr, prioridade, rotacao, telas_alvo, dias_semana, horarios
       FROM campanhas
      WHERE tenant_id = ? AND status = 'ativa'
        AND (inicio IS NULL OR inicio = '' OR inicio <= ?)
        AND (fim IS NULL OR fim = '' OR fim >= ?)
        AND (tipo_tela = 'todas' OR tipo_tela = ?)
      ORDER BY prioridade DESC, id`,
  )
    .bind(tela.tenant_id, dia, dia, tela.tipo)
    .all<Record<string, unknown>>()

  const origem = new URL(c.req.url).origin
  const daTela = results.filter((cp) => {
    const alvo = lista<number>(cp.telas_alvo).map(Number)
    return !alvo.length || alvo.includes(tela.id)
  })

  // peças aprovadas e dentro do próprio período
  const pecasPor = new Map<number, Record<string, unknown>[]>()
  if (daTela.length) {
    const { results: pecas } = await c.env.DB.prepare(
      `SELECT id, campanha_id, nome, midia_tipo, midia_url, duracao, texto, link_qr, peso, ajuste
         FROM pecas
        WHERE tenant_id = ? AND status = 'aprovada'
          AND (inicio IS NULL OR inicio = '' OR inicio <= ?)
          AND (fim IS NULL OR fim = '' OR fim >= ?)
          AND campanha_id IN (SELECT id FROM campanhas WHERE tenant_id = ? AND status = 'ativa')
        ORDER BY campanha_id, ordem, id`,
    )
      .bind(tela.tenant_id, dia, dia, tela.tenant_id)
      .all<Record<string, unknown>>()
    const ids = new Set(daTela.map((cp) => Number(cp.id)))
    for (const p of pecas) {
      const k = Number(p.campanha_id)
      if (!ids.has(k)) continue
      if (!pecasPor.has(k)) pecasPor.set(k, [])
      pecasPor.get(k)!.push(p)
    }
  }

  const campanhas = daTela
    .filter((cp) => pecasPor.has(Number(cp.id)))
    .map((cp) => ({
      id: cp.id,
      nome: cp.nome,
      duracao: cp.duracao, // duração do espaço comprado
      prioridade: cp.prioridade,
      rotacao: cp.rotacao,
      pecas: pecasPor.get(Number(cp.id))!.map((p) => ({
        id: p.id,
        tipo: p.midia_tipo,
        url: p.midia_url,
        duracao: p.duracao,
        texto: p.texto,
        peso: cp.rotacao === 'peso' ? p.peso : 1,
        ajuste: p.ajuste === 'inteira' ? 'inteira' : 'preencher',
        qr_url: p.link_qr || cp.link_qr ? `${origem}/api/r/${cp.id}/${tela.id}/${p.id}` : null,
      })),
      // dia e horário são conferidos no próprio player (ele guarda a programação e funciona offline)
      dias_semana: lista<number>(cp.dias_semana).map(Number),
      horarios: lista<Janela>(cp.horarios),
    }))
    // compatibilidade: player antigo (antes das peças) ainda lê a mídia direto da campanha até recarregar
    .map((cp) => ({ ...cp, midia_tipo: cp.pecas[0].tipo, midia_url: cp.pecas[0].url, texto: cp.pecas[0].texto, qr_url: cp.pecas[0].qr_url }))

  let conteudo: unknown[] = []
  try { conteudo = JSON.parse(tela.conteudo || '[]') } catch { /* vazio */ }

  return c.json({
    tela: {
      id: tela.id,
      nome: tela.nome,
      codigo: tela.codigo,
      tipo: tela.tipo,
      layout: tela.layout,
      cor_primaria: tela.cor_primaria,
      cor_fundo: tela.cor_fundo,
      logo_url: tela.logo_url,
      ticker: tela.ticker,
      conteudo,
    },
    campanhas,
    ciclo: await cicloDoTenant(c.env.DB, tela.tenant_id),
    programacao_min: PROGRAMACAO_MIN,
    envio_min: intervaloExibicoes(telasAtivas, campanhas.length),
    gerado_em: new Date().toISOString(),
  })
})

// Sinal de vida avulso. Players atuais mandam o sinal junto com o GET da programação;
// esta rota fica para players antigos que ainda não recarregaram.
player.post('/:codigo/ping', async (c) => {
  const corpo = await c.req.json().catch(() => ({}))
  const r = await c.env.DB.prepare("UPDATE telas SET ultimo_ping = datetime('now'), ultima_info = ? WHERE codigo = ?")
    .bind(JSON.stringify(corpo).slice(0, 500), c.req.param('codigo').toUpperCase())
    .run()
  return c.json({ ok: r.meta.changes > 0 })
})

// Prova de exibição em lote: [{ campanha_id, dia, total, pecas: { "<peca_id>": n } }]
// Uma linha por campanha/tela/dia; a contagem por peça vai num JSON na mesma linha (economiza gravações no D1).
player.post('/:codigo/exibicoes', async (c) => {
  const tela = await buscarTela(c.env.DB, c.req.param('codigo'))
  if (!tela) return c.json({ erro: 'Tela não encontrada' }, 404)
  const { itens } = await c.req.json<{ itens: { campanha_id: number; dia: string; total: number; pecas?: Record<string, number> }[] }>()
  const validos = (itens || [])
    .filter((i) => Number.isInteger(i.campanha_id) && /^\d{4}-\d{2}-\d{2}$/.test(i.dia) && i.total > 0 && i.total < 100000)
    .slice(0, 200)
  if (!validos.length) return c.json({ ok: true, gravados: 0 })

  // soma as peças ao que já está gravado
  const dias = [...new Set(validos.map((i) => i.dia))]
  const { results: atuais } = await c.env.DB.prepare(
    `SELECT campanha_id, dia, pecas FROM exibicoes WHERE tela_id = ? AND dia IN (${dias.map(() => '?').join(',')})`,
  )
    .bind(tela.id, ...dias)
    .all<{ campanha_id: number; dia: string; pecas: string }>()
  const gravadas = new Map(atuais.map((a) => [`${a.campanha_id}|${a.dia}`, a.pecas]))

  const stmt = c.env.DB.prepare(
    `INSERT INTO exibicoes (tenant_id, campanha_id, tela_id, dia, total, pecas)
     SELECT ?, id, ?, ?, ?, ? FROM campanhas WHERE id = ? AND tenant_id = ?
     ON CONFLICT (campanha_id, tela_id, dia) DO UPDATE SET total = total + excluded.total, pecas = excluded.pecas`,
  )
  await c.env.DB.batch(
    validos.map((i) => {
      let pecas: Record<string, number> = {}
      try { pecas = JSON.parse(gravadas.get(`${i.campanha_id}|${i.dia}`) || '{}') } catch { /* recomeça */ }
      for (const [pid, n] of Object.entries(i.pecas || {})) {
        if (/^\d+$/.test(pid) && Number(n) > 0) pecas[pid] = (Number(pecas[pid]) || 0) + Math.round(Number(n))
      }
      return stmt.bind(tela.tenant_id, tela.id, i.dia, Math.round(i.total), JSON.stringify(pecas), i.campanha_id, tela.tenant_id)
    }),
  )
  return c.json({ ok: true, gravados: validos.length })
})

/** Redirecionamento do QR code: conta a leitura e leva ao link do anunciante. */
export const redirecionarQr = new Hono<AppEnv>()

async function qr(c: Context<AppEnv>) {
  const cid = Number(c.req.param('cid'))
  const tid = Number(c.req.param('tid'))
  const pid = Number(c.req.param('pid')) || 0
  // link da peça; se vazio, o da campanha
  const cp = await c.env.DB.prepare(
    `SELECT cp.tenant_id, COALESCE(NULLIF(p.link_qr, ''), cp.link_qr) AS link_qr
       FROM campanhas cp LEFT JOIN pecas p ON p.id = ? AND p.campanha_id = cp.id
      WHERE cp.id = ?`,
  )
    .bind(pid, cid)
    .first<{ tenant_id: string; link_qr: string | null }>()
  if (!cp?.link_qr) return c.text('Link não encontrado', 404)
  await c.env.DB.prepare(
    `INSERT INTO exibicoes (tenant_id, campanha_id, tela_id, dia, total, qr) VALUES (?, ?, ?, ?, 0, 1)
     ON CONFLICT (campanha_id, tela_id, dia) DO UPDATE SET qr = qr + 1`,
  )
    .bind(cp.tenant_id, cid, tid, hoje())
    .run()
  const destino = /^https?:\/\//i.test(cp.link_qr) ? cp.link_qr : `https://${cp.link_qr}`
  return c.redirect(destino, 302)
}
redirecionarQr.get('/:cid/:tid', qr)
redirecionarQr.get('/:cid/:tid/:pid', qr)
