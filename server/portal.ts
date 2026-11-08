import { Hono } from 'hono'
import { cteAudiencia, padroesAudiencia, SQL_IMPACTOS } from './audiencia'
import { guardarArquivo } from './media'
import { validarPecas } from './pecas'
import { pixCopiaECola } from './pix'
import { novoToken } from './relatorio'
import { hoje, type AppEnv } from './types'

/**
 * Portal do anunciante (link exclusivo por cliente, sem senha, revogável):
 * campanhas com números dos últimos 30 dias e relatório ao vivo, envio de arte nova (entra para aprovação)
 * e faturas com Pix copia e cola / QR com o valor exato.
 */
export const portal = new Hono<AppEnv>()

async function clienteDoToken(db: D1Database, token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  return db
    .prepare('SELECT c.id, c.tenant_id, c.nome, t.nome AS empresa, t.config FROM clientes c JOIN tenants t ON t.id = c.tenant_id WHERE c.token_portal = ?')
    .bind(token)
    .first<{ id: number; tenant_id: string; nome: string; empresa: string; config: string }>()
}

portal.get('/:token', async (c) => {
  const db = c.env.DB
  const cl = await clienteDoToken(db, c.req.param('token'))
  if (!cl) return c.json({ erro: 'Link inválido ou revogado. Peça um novo link à empresa.' }, 404)
  let cfg: Record<string, any> = {}
  try { cfg = JSON.parse(cl.config || '{}') } catch { /* vazio */ }
  const de = hoje(new Date(Date.now() - 29 * 86400000))
  const cte = cteAudiencia(await padroesAudiencia(db, cl.tenant_id), cl.tenant_id)
  const [camps, pecas, faturas] = await db.batch([
    db.prepare(
      `${cte.sql}
       SELECT cp.id, cp.nome, cp.status, cp.inicio, cp.fim, cp.duracao, cp.token_publico,
              COALESCE(SUM(e.total), 0) AS exibicoes, COALESCE(SUM(e.qr), 0) AS qr, ${SQL_IMPACTOS} AS impactos
         FROM campanhas cp
         LEFT JOIN exibicoes e ON e.campanha_id = cp.id AND e.dia >= ?
         LEFT JOIN aud a ON a.id = e.tela_id
        WHERE cp.tenant_id = ? AND cp.cliente_id = ? AND cp.status <> 'rascunho'
        GROUP BY cp.id ORDER BY (cp.status = 'ativa') DESC, cp.id DESC LIMIT 30`,
    ).bind(...cte.binds, de, cl.tenant_id, cl.id),
    db.prepare(
      `SELECT p.id, p.campanha_id, p.nome, p.midia_tipo, p.midia_url, p.status, p.origem FROM pecas p
         JOIN campanhas cp ON cp.id = p.campanha_id WHERE cp.tenant_id = ? AND cp.cliente_id = ? ORDER BY p.ordem, p.id`,
    ).bind(cl.tenant_id, cl.id),
    db.prepare('SELECT id, descricao, competencia, valor, vencimento, status, pago_em FROM faturas WHERE tenant_id = ? AND cliente_id = ? AND status <> ? ORDER BY vencimento DESC LIMIT 12')
      .bind(cl.tenant_id, cl.id, 'cancelada'),
  ])
  const campanhas = camps.results as Record<string, any>[]
  // cada campanha ganha o link do relatório ao vivo (gerado uma vez)
  const semToken = campanhas.filter((x) => !x.token_publico)
  if (semToken.length) {
    for (const x of semToken) x.token_publico = novoToken()
    await db.batch(semToken.slice(0, 40).map((x) => db.prepare('UPDATE campanhas SET token_publico = ? WHERE id = ? AND token_publico IS NULL').bind(x.token_publico, x.id)))
  }
  const porCampanha = new Map<number, Record<string, unknown>[]>()
  for (const p of pecas.results as Record<string, unknown>[]) {
    const k = Number(p.campanha_id)
    if (!porCampanha.has(k)) porCampanha.set(k, [])
    porCampanha.get(k)!.push(p)
  }
  const chave = String(cfg.chave_pix || '').trim()
  const cidade = String(cfg.cidade || '').split(/\s*[-,/]\s*/)[0] || 'BRASIL'
  c.header('Cache-Control', 'no-store')
  return c.json({
    cliente: cl.nome,
    empresa: cl.empresa,
    whatsapp: cfg.whatsapp || null,
    chave_pix: chave || null,
    campanhas: campanhas.map((x) => ({ ...x, impactos: Math.round(Number(x.impactos) || 0), pecas: porCampanha.get(Number(x.id)) || [] })),
    faturas: (faturas.results as Record<string, any>[]).map((f) => ({
      ...f,
      pix: f.status === 'aberta' && chave ? pixCopiaECola({ chave, nome: cl.empresa, cidade, valor: Number(f.valor), txid: `FAT${f.id}` }) : null,
    })),
  })
})

// O anunciante envia uma arte nova para uma campanha dele: entra como "aguardando aprovação".
portal.post('/:token/campanha/:id/peca', async (c) => {
  const db = c.env.DB
  const cl = await clienteDoToken(db, c.req.param('token'))
  if (!cl) return c.json({ erro: 'Link inválido ou revogado.' }, 404)
  const cid = Number(c.req.param('id'))
  const cp = await db.prepare('SELECT id, duracao FROM campanhas WHERE id = ? AND tenant_id = ? AND cliente_id = ?').bind(cid, cl.tenant_id, cl.id).first<{ id: number; duracao: number }>()
  if (!cp) return c.json({ erro: 'Campanha não encontrada.' }, 404)
  const pend = await db.prepare("SELECT COUNT(*) AS n FROM pecas WHERE campanha_id = ? AND origem = 'portal' AND status = 'aguardando'").bind(cid).first<{ n: number }>()
  if ((pend?.n || 0) >= 5) return c.json({ erro: 'Já há 5 artes aguardando aprovação nesta campanha. Aguarde a revisão.' }, 429)
  const form = await c.req.parseBody()
  const video = String((form['arquivo'] as File | undefined)?.type || '').startsWith('video')
  const duracao = video ? Math.round(Number(form['duracao']) || 0) || null : null
  if (video) {
    const erroDur = validarPecas([{ midia_tipo: 'video', duracao, nome: 'O vídeo' }], cp.duracao)
    if (erroDur) return c.json({ erro: erroDur }, 400)
  }
  const r = await guardarArquivo(c.env, cl.tenant_id, form['arquivo'])
  if ('erro' in r) return c.json({ erro: r.erro }, r.status)
  const nome = String(form['nome'] || '').trim().slice(0, 80) || 'Arte enviada pelo cliente'
  await db
    .prepare(
      `INSERT INTO pecas (tenant_id, campanha_id, nome, midia_tipo, midia_url, duracao, status, origem, ordem)
       VALUES (?, ?, ?, ?, ?, ?, 'aguardando', 'portal', (SELECT COALESCE(MAX(ordem), 0) + 1 FROM pecas WHERE campanha_id = ?))`,
    )
    .bind(cl.tenant_id, cid, nome, video ? 'video' : 'imagem', r.url, duracao, cid)
    .run()
  return c.json({ ok: true }, 201)
})
