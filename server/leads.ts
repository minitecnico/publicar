import { Hono, type Context } from 'hono'
import { hoje, type AppEnv } from './types'

/**
 * Atribuição: o QR da tela passa por aqui, conta a leitura (por tela, dia e hora) e leva o cliente ao anunciante.
 * - Campanha com cupom: gera um código único por leitura e mostra numa página leve, com o botão do WhatsApp
 *   (a mensagem já leva o código). A loja valida o código num link próprio: prova de venda, não só de exibição.
 * - Só WhatsApp: abre a conversa com a mensagem pronta.
 * - Senão: redireciona para o link da peça ou da campanha.
 */
export const redirecionarQr = new Hono<AppEnv>()

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const codigoCupom = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (n) => ALFABETO[n % ALFABETO.length]).join('')

/** Hora atual (0-23) no fuso de Brasília. */
export const horaBR = () => Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false })) % 24

/** Número de WhatsApp em formato internacional (só dígitos; DDD sem 55 recebe o 55). */
export function numeroWhats(v: unknown): string | null {
  const d = String(v || '').replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d.length >= 12 && d.length <= 13 ? d : null
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)
const dataBR = (d: string) => d.split('-').reverse().join('/')

function paginaCupom(o: { anunciante: string; campanha: string; oferta: string; codigo: string; validade: string; whats: string | null; site: string | null }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seu cupom · ${esc(o.anunciante)}</title><meta name="robots" content="noindex">
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f5f2;color:#1e1e1e;min-height:100vh;display:grid;place-items:center;padding:20px}
.c{background:#fff;border:1px solid #e4e2dc;border-radius:20px;max-width:420px;width:100%;padding:28px 22px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.06)}
.a{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:#6b6b66;font-weight:700}h1{margin:6px 0 4px;font-size:1.55rem;line-height:1.15}
.o{font-size:1.05rem;color:#3a3a36;margin:0 0 18px}.cod{font:800 2.4rem/1 ui-monospace,Menlo,monospace;letter-spacing:.18em;background:#fdf3e6;color:#8a520f;border:2px dashed #e9a453;border-radius:14px;padding:18px 10px;margin:0 0 8px}
.v{font-size:.85rem;color:#6b6b66;margin:0 0 20px}.b{display:block;text-decoration:none;font-weight:700;border-radius:12px;padding:15px;margin-top:10px;font-size:1.02rem}
.w{background:#25d366;color:#fff}.s{background:#1e1e1e;color:#fff}.p{font-size:.78rem;color:#8a8a84;margin-top:18px}
</style></head><body><main class="c">
<div class="a">${esc(o.anunciante)}</div><h1>Seu cupom chegou!</h1><p class="o">${esc(o.oferta)}</p>
<div class="cod">${esc(o.codigo)}</div><p class="v">Válido até ${esc(o.validade)} · mostre este código na loja</p>
${o.whats ? `<a class="b w" href="${esc(o.whats)}">Chamar no WhatsApp</a>` : ''}
${o.site ? `<a class="b s" href="${esc(o.site)}">Ver mais</a>` : ''}
<p class="p">Tire um print desta tela para não perder o código.</p>
</main></body></html>`
}

async function qr(c: Context<AppEnv>) {
  const cid = Number(c.req.param('cid'))
  const tid = Number(c.req.param('tid'))
  const pid = Number(c.req.param('pid')) || 0
  const db = c.env.DB
  const cp = await db
    .prepare(
      `SELECT cp.tenant_id, cp.nome, cp.whatsapp, cp.whatsapp_msg, cp.cupom_oferta, cp.cupom_validade, cl.nome AS anunciante,
              COALESCE(NULLIF(p.link_qr, ''), cp.link_qr) AS link
         FROM campanhas cp
         LEFT JOIN pecas p ON p.id = ? AND p.campanha_id = cp.id
         LEFT JOIN clientes cl ON cl.id = cp.cliente_id
        WHERE cp.id = ?`,
    )
    .bind(pid, cid)
    .first<{ tenant_id: string; nome: string; whatsapp: string | null; whatsapp_msg: string | null; cupom_oferta: string | null; cupom_validade: number; anunciante: string | null; link: string | null }>()
  if (!cp) return c.text('Link não encontrado', 404)

  const whats = numeroWhats(cp.whatsapp)
  const site = cp.link ? (/^https?:\/\//i.test(cp.link) ? cp.link : `https://${cp.link}`) : null
  const oferta = (cp.cupom_oferta || '').trim()
  if (!whats && !site && !oferta) return c.text('Link não encontrado', 404)

  // conta a leitura (total e por hora) na linha agregada campanha/tela/dia
  const h = String(horaBR())
  await db
    .prepare(
      `INSERT INTO exibicoes (tenant_id, campanha_id, tela_id, dia, total, qr, qr_horas) VALUES (?, ?, ?, ?, 0, 1, json_object(?, 1))
       ON CONFLICT (campanha_id, tela_id, dia) DO UPDATE SET qr = qr + 1,
         qr_horas = json_set(qr_horas, '$."' || ? || '"', COALESCE(json_extract(qr_horas, '$."' || ? || '"'), 0) + 1)`,
    )
    .bind(cp.tenant_id, cid, tid, hoje(), h, h, h)
    .run()

  const anunciante = cp.anunciante || cp.nome
  const msgBase = (cp.whatsapp_msg || '').trim() || `Olá! Vi o anúncio de ${anunciante} na tela do Publicar e quero saber mais.`

  if (oferta) {
    const validade = hoje(new Date(Date.now() + Math.max(1, Math.min(90, cp.cupom_validade || 7)) * 86400000))
    let codigo = codigoCupom()
    for (let i = 0; i < 3; i++) {
      const r = await db
        .prepare('INSERT OR IGNORE INTO cupons (codigo, tenant_id, campanha_id, tela_id, peca_id, expira_em) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(codigo, cp.tenant_id, cid, tid || null, pid || null, validade)
        .run()
      if (r.meta.changes) break
      codigo = codigoCupom()
    }
    const linkWhats = whats ? `https://wa.me/${whats}?text=${encodeURIComponent(`${msgBase} Meu cupom: ${codigo}`)}` : null
    c.header('Cache-Control', 'no-store')
    return c.html(paginaCupom({ anunciante, campanha: cp.nome, oferta, codigo, validade: dataBR(validade), whats: linkWhats, site }))
  }
  if (whats && (!site || /wa\.me|whatsapp\.com/i.test(site))) return c.redirect(`https://wa.me/${whats}?text=${encodeURIComponent(msgBase)}`, 302)
  if (site && /wa\.me\/\d+\/?$/i.test(site)) return c.redirect(`${site.replace(/\/$/, '')}?text=${encodeURIComponent(msgBase)}`, 302)
  return c.redirect(site!, 302)
}
redirecionarQr.get('/:cid/:tid', qr)
redirecionarQr.get('/:cid/:tid/:pid', qr)

/* ------------------------------------------------------------------ validação na loja (link sem login) */
export const loja = new Hono<AppEnv>()

async function campanhaDaLoja(db: D1Database, token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  return db
    .prepare(
      `SELECT cp.id, cp.tenant_id, cp.nome, cp.cupom_oferta, cl.nome AS anunciante
         FROM campanhas cp LEFT JOIN clientes cl ON cl.id = cp.cliente_id WHERE cp.token_loja = ?`,
    )
    .bind(token)
    .first<{ id: number; tenant_id: string; nome: string; cupom_oferta: string | null; anunciante: string | null }>()
}

loja.get('/:token', async (c) => {
  const cp = await campanhaDaLoja(c.env.DB, c.req.param('token'))
  if (!cp) return c.json({ erro: 'Link inválido ou revogado. Peça um novo link à empresa de mídia.' }, 404)
  const [resumo, ultimos] = await c.env.DB.batch([
    c.env.DB.prepare(
      'SELECT COUNT(*) AS gerados, COUNT(usado_em) AS usados, COALESCE(SUM(valor_venda), 0) AS vendas FROM cupons WHERE campanha_id = ? AND tenant_id = ?',
    ).bind(cp.id, cp.tenant_id),
    c.env.DB.prepare(
      'SELECT codigo, usado_em, valor_venda FROM cupons WHERE campanha_id = ? AND tenant_id = ? AND usado_em IS NOT NULL ORDER BY usado_em DESC LIMIT 15',
    ).bind(cp.id, cp.tenant_id),
  ])
  c.header('Cache-Control', 'no-store')
  return c.json({ campanha: cp.nome, anunciante: cp.anunciante, oferta: cp.cupom_oferta, resumo: resumo.results[0], ultimos: ultimos.results })
})

loja.post('/:token/validar', async (c) => {
  const cp = await campanhaDaLoja(c.env.DB, c.req.param('token'))
  if (!cp) return c.json({ erro: 'Link inválido ou revogado.' }, 404)
  const { codigo, valor } = await c.req.json<{ codigo?: string; valor?: number }>().catch(() => ({ codigo: '', valor: undefined }))
  const cod = String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cod.length !== 6) return c.json({ erro: 'O código tem 6 letras/números.' }, 400)
  const cupom = await c.env.DB.prepare('SELECT codigo, expira_em, usado_em FROM cupons WHERE codigo = ? AND campanha_id = ? AND tenant_id = ?')
    .bind(cod, cp.id, cp.tenant_id)
    .first<{ codigo: string; expira_em: string; usado_em: string | null }>()
  if (!cupom) return c.json({ erro: 'Cupom não encontrado para esta campanha.' }, 404)
  if (cupom.usado_em) return c.json({ erro: `Cupom já usado em ${cupom.usado_em.slice(0, 16).replace(' ', ' às ')} (UTC).` }, 409)
  if (cupom.expira_em < hoje()) return c.json({ erro: `Cupom vencido em ${dataBR(cupom.expira_em)}.` }, 410)
  const v = Number(valor)
  await c.env.DB.prepare("UPDATE cupons SET usado_em = datetime('now'), valor_venda = ? WHERE codigo = ? AND usado_em IS NULL")
    .bind(Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null, cod)
    .run()
  return c.json({ ok: true, oferta: cp.cupom_oferta })
})
