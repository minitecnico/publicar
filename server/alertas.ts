import { Hono } from 'hono'
import type { AppEnv } from './types'

/**
 * Alertas de tela offline por WhatsApp (CallMeBot, gratuito para o próprio número) ou webhook.
 * Chamado a cada 15 min pelo GitHub Actions (.github/workflows/alertas.yml). É seguro chamar a qualquer hora:
 * cada queda gera um único alerta, e a tela que volta gera um aviso de retorno. Sem segredo: no máximo
 * uma execução a cada 5 min (o resto é ignorado).
 */
export const cron = new Hono<AppEnv>()

interface CfgAlerta { ativo?: boolean; telefone?: string; apikey?: string; webhook?: string; minutos?: number; inicio?: string; fim?: string }

const minutosDoDia = (h: string) => {
  const [a, b] = String(h || '').split(':').map(Number)
  return (a || 0) * 60 + (b || 0)
}
function agoraBR() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]))
  return (Number(p.hour) % 24) * 60 + Number(p.minute)
}
/** Dentro do horário de operação? (fim menor que início = atravessa a meia-noite) */
function emOperacao(c: CfgAlerta) {
  const i = minutosDoDia(c.inicio || '07:00')
  const f = minutosDoDia(c.fim || '22:00')
  const m = agoraBR()
  return f > i ? m >= i && m < f : m >= i || m < f
}

export async function enviarAlerta(c: CfgAlerta, texto: string) {
  const envios: Promise<unknown>[] = []
  const fone = String(c.telefone || '').replace(/\D/g, '')
  if (fone && c.apikey) {
    const numero = fone.length <= 11 ? `55${fone}` : fone
    envios.push(fetch(`https://api.callmebot.com/whatsapp.php?phone=${numero}&text=${encodeURIComponent(texto)}&apikey=${encodeURIComponent(c.apikey)}`, { signal: AbortSignal.timeout(8000) }))
  }
  if (c.webhook && /^https:\/\//.test(c.webhook)) {
    envios.push(fetch(c.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }), signal: AbortSignal.timeout(8000) }))
  }
  const r = await Promise.allSettled(envios)
  return r.some((x) => x.status === 'fulfilled' && (x.value as Response).ok)
}

cron.post('/alertas', async (c) => {
  const db = c.env.DB
  // trava simples: uma execução a cada 5 min
  const ultima = await db.prepare("SELECT value FROM settings WHERE key = 'cron:alertas'").first<{ value: string }>()
  if (ultima && Date.now() - Number(ultima.value) < 5 * 60 * 1000) return c.json({ ok: true, ignorado: 'executado há menos de 5 min' })
  await db.prepare("INSERT INTO settings (key, value) VALUES ('cron:alertas', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(String(Date.now())).run()

  const { results: tenants } = await db.prepare('SELECT id, nome, config FROM tenants').all<{ id: string; nome: string; config: string }>()
  const resumo: Record<string, { caiu: number; voltou: number }> = {}
  for (const t of tenants) {
    let cfg: { alertas?: CfgAlerta } = {}
    try { cfg = JSON.parse(t.config || '{}') } catch { /* sem config */ }
    const a = cfg.alertas
    if (!a?.ativo || (!(a.telefone && a.apikey) && !a.webhook)) continue
    const limite = Math.max(15, Math.min(240, Number(a.minutos) || 30))
    const [caiu, voltou] = await db.batch([
      // offline há mais que o limite, que já conectou alguma vez, ainda não avisada nesta queda
      db.prepare(
        `SELECT id, nome, bairro, ultimo_ping FROM telas
          WHERE tenant_id = ? AND status = 'ativa' AND ultimo_ping IS NOT NULL
            AND ultimo_ping < datetime('now', ?) AND (alerta_offline_em IS NULL OR alerta_offline_em < ultimo_ping)
          ORDER BY nome LIMIT 30`,
      ).bind(t.id, `-${limite} minutes`),
      // avisadas que voltaram a dar sinal
      db.prepare(
        `SELECT id, nome FROM telas WHERE tenant_id = ? AND alerta_offline_em IS NOT NULL AND ultimo_ping > alerta_offline_em ORDER BY nome LIMIT 30`,
      ).bind(t.id),
    ])
    const quedas = caiu.results as { id: number; nome: string; bairro: string | null; ultimo_ping: string }[]
    const retornos = voltou.results as { id: number; nome: string }[]
    const linhas: string[] = []
    // fora do horário de operação não avisa queda (carro desligado à noite é normal); retorno sempre limpa o estado
    const avisarQuedas = emOperacao(a) && quedas.length > 0
    if (avisarQuedas) {
      linhas.push(`⚠️ ${t.nome}: ${quedas.length} tela(s) sem sinal há mais de ${limite} min`)
      for (const q of quedas.slice(0, 10)) linhas.push(`• ${q.nome}${q.bairro ? ` (${q.bairro})` : ''}`)
      if (quedas.length > 10) linhas.push(`• e mais ${quedas.length - 10}`)
    }
    if (retornos.length && emOperacao(a)) linhas.push(`✅ Voltaram: ${retornos.map((r) => r.nome).slice(0, 10).join(', ')}`)
    const enviado = linhas.length ? await enviarAlerta(a, linhas.join('\n')) : false
    const stmts: D1PreparedStatement[] = []
    if (avisarQuedas && enviado) for (const q of quedas) stmts.push(db.prepare("UPDATE telas SET alerta_offline_em = datetime('now') WHERE id = ?").bind(q.id))
    for (const r of retornos) stmts.push(db.prepare('UPDATE telas SET alerta_offline_em = NULL WHERE id = ?').bind(r.id))
    if (stmts.length) await db.batch(stmts.slice(0, 45))
    resumo[t.id] = { caiu: avisarQuedas ? quedas.length : 0, voltou: retornos.length }
  }
  return c.json({ ok: true, resumo })
})
