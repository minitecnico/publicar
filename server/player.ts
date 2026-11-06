import { Hono } from 'hono'
import { hoje, type AppEnv } from './types'

/** Rotas públicas usadas pelas telas (tablets e TVs). Identificação pelo código da tela. */
export const player = new Hono<AppEnv>()

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
  const { results } = await c.env.DB.prepare(
    `SELECT id, nome, midia_tipo, midia_url, duracao, link_qr, texto, prioridade, telas_alvo
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
  const campanhas = results
    .filter((cp) => {
      let alvo: number[] = []
      try { alvo = JSON.parse((cp.telas_alvo as string) || '[]') } catch { /* lista vazia = todas */ }
      return !alvo.length || alvo.map(Number).includes(tela.id)
    })
    .map((cp) => ({
      id: cp.id,
      nome: cp.nome,
      midia_tipo: cp.midia_tipo,
      midia_url: cp.midia_url,
      duracao: cp.duracao,
      texto: cp.texto,
      prioridade: cp.prioridade,
      qr_url: cp.link_qr ? `${origem}/api/r/${cp.id}/${tela.id}` : null,
    }))

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
    gerado_em: new Date().toISOString(),
  })
})

// Batimento cardíaco: a tela avisa que está viva (a cada ~5 min).
player.post('/:codigo/ping', async (c) => {
  const corpo = await c.req.json().catch(() => ({}))
  const r = await c.env.DB.prepare("UPDATE telas SET ultimo_ping = datetime('now'), ultima_info = ? WHERE codigo = ?")
    .bind(JSON.stringify(corpo).slice(0, 500), c.req.param('codigo').toUpperCase())
    .run()
  return c.json({ ok: r.meta.changes > 0 })
})

// Prova de exibição em lote: [{ campanha_id, dia, total }]
player.post('/:codigo/exibicoes', async (c) => {
  const tela = await buscarTela(c.env.DB, c.req.param('codigo'))
  if (!tela) return c.json({ erro: 'Tela não encontrada' }, 404)
  const { itens } = await c.req.json<{ itens: { campanha_id: number; dia: string; total: number }[] }>()
  const validos = (itens || [])
    .filter((i) => Number.isInteger(i.campanha_id) && /^\d{4}-\d{2}-\d{2}$/.test(i.dia) && i.total > 0 && i.total < 100000)
    .slice(0, 200)
  if (!validos.length) return c.json({ ok: true, gravados: 0 })
  const stmt = c.env.DB.prepare(
    `INSERT INTO exibicoes (tenant_id, campanha_id, tela_id, dia, total)
     SELECT ?, id, ?, ?, ? FROM campanhas WHERE id = ? AND tenant_id = ?
     ON CONFLICT (campanha_id, tela_id, dia) DO UPDATE SET total = total + excluded.total`,
  )
  await c.env.DB.batch(
    validos.map((i) => stmt.bind(tela.tenant_id, tela.id, i.dia, Math.round(i.total), i.campanha_id, tela.tenant_id)),
  )
  return c.json({ ok: true, gravados: validos.length })
})

/** Redirecionamento do QR code: conta a leitura e leva ao link do anunciante. */
export const redirecionarQr = new Hono<AppEnv>()

redirecionarQr.get('/:cid/:tid', async (c) => {
  const cid = Number(c.req.param('cid'))
  const tid = Number(c.req.param('tid'))
  const cp = await c.env.DB.prepare('SELECT tenant_id, link_qr FROM campanhas WHERE id = ?')
    .bind(cid)
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
})
