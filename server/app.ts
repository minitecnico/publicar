import { Hono } from 'hono'
import { conferirSenha, emitirToken, exigirAdmin, exigirLogin, hashSenha } from './auth'
import { crud } from './crud'
import { enviarMidia, servirMidia } from './media'
import { player, redirecionarQr } from './player'
import { hoje, mesAtual, type AppEnv } from './types'

export const app = new Hono<AppEnv>().basePath('/api')

app.onError((err, c) => {
  console.error(err)
  const msg = String(err?.message || err)
  if (msg.includes('UNIQUE')) return c.json({ erro: 'Registro duplicado' }, 409)
  if (msg.includes('no such table')) return c.json({ erro: 'Banco sem tabelas: rode as migrations do D1' }, 500)
  return c.json({ erro: 'Erro interno', detalhe: msg }, 500)
})

/* ---------------------------------------------------------------- públicas */

app.get('/saude', (c) => c.json({ ok: true, app: 'publicar', hora: new Date().toISOString() }))

app.get('/auth/status', async (c) => {
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM usuarios').first<{ n: number }>()
  return c.json({ precisaConfigurar: !n?.n })
})

// Primeiro acesso: cria a empresa (tenant) e o administrador. Só funciona com o banco vazio.
app.post('/auth/setup', async (c) => {
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM usuarios').first<{ n: number }>()
  if (n?.n) return c.json({ erro: 'Sistema já configurado' }, 409)
  const { empresa, nome, email, senha } = await c.req.json<Record<string, string>>()
  if (!empresa || !nome || !email || !senha || senha.length < 8)
    return c.json({ erro: 'Preencha empresa, nome, e-mail e senha (mínimo 8 caracteres)' }, 400)
  const tid = 'principal'
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT OR IGNORE INTO tenants (id, nome, config) VALUES (?, ?, ?)').bind(
      tid,
      empresa,
      JSON.stringify({ empresa, mensagem_cobranca: 'Olá {cliente}! A fatura {descricao} de {valor} vence em {vencimento}. Chave Pix: {pix}. Obrigado!' }),
    ),
    c.env.DB.prepare("INSERT INTO usuarios (tenant_id, nome, email, senha_hash, papel) VALUES (?, ?, ?, ?, 'admin')").bind(
      tid,
      nome,
      email.toLowerCase().trim(),
      await hashSenha(senha),
    ),
  ])
  const u = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(email.toLowerCase().trim()).first<{ id: number }>()
  const token = await emitirToken(c.env, { sub: u!.id, tid, papel: 'admin', nome })
  return c.json({ token, usuario: { nome, email, papel: 'admin' } })
})

app.post('/auth/login', async (c) => {
  const { email, senha } = await c.req.json<Record<string, string>>()
  const u = await c.env.DB.prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1')
    .bind(String(email || '').toLowerCase().trim())
    .first<{ id: number; tenant_id: string; nome: string; email: string; senha_hash: string; papel: 'admin' | 'operador' }>()
  if (!u || !(await conferirSenha(String(senha || ''), u.senha_hash))) return c.json({ erro: 'E-mail ou senha incorretos' }, 401)
  const token = await emitirToken(c.env, { sub: u.id, tid: u.tenant_id, papel: u.papel, nome: u.nome })
  return c.json({ token, usuario: { nome: u.nome, email: u.email, papel: u.papel } })
})

app.route('/player', player)
app.route('/r', redirecionarQr)
app.get('/media/*', servirMidia)

/* -------------------------------------------------------------- protegidas */

app.use('/*', exigirLogin)

app.get('/auth/me', (c) => c.json(c.get('sessao')))

app.post('/media', enviarMidia)

app.get('/config', async (c) => {
  const t = await c.env.DB.prepare('SELECT * FROM tenants WHERE id = ?').bind(c.get('sessao').tid).first<Record<string, string>>()
  return c.json({ nome: t?.nome, modulos: JSON.parse(t?.modulos || '[]'), config: JSON.parse(t?.config || '{}') })
})

app.put('/config', exigirAdmin, async (c) => {
  const { nome, modulos, config } = await c.req.json<{ nome: string; modulos: string[]; config: Record<string, unknown> }>()
  await c.env.DB.prepare('UPDATE tenants SET nome = ?, modulos = ?, config = ? WHERE id = ?')
    .bind(nome, JSON.stringify(modulos || []), JSON.stringify(config || {}), c.get('sessao').tid)
    .run()
  return c.json({ ok: true })
})

app.get('/usuarios', exigirAdmin, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, nome, email, papel, ativo, created_at FROM usuarios WHERE tenant_id = ? ORDER BY id')
    .bind(c.get('sessao').tid)
    .all()
  return c.json(results)
})

app.post('/usuarios', exigirAdmin, async (c) => {
  const { nome, email, senha, papel } = await c.req.json<Record<string, string>>()
  if (!nome || !email || !senha || senha.length < 8) return c.json({ erro: 'Nome, e-mail e senha (mín. 8) obrigatórios' }, 400)
  await c.env.DB.prepare('INSERT INTO usuarios (tenant_id, nome, email, senha_hash, papel) VALUES (?, ?, ?, ?, ?)')
    .bind(c.get('sessao').tid, nome, email.toLowerCase().trim(), await hashSenha(senha), papel === 'admin' ? 'admin' : 'operador')
    .run()
  return c.json({ ok: true }, 201)
})

app.delete('/usuarios/:id', exigirAdmin, async (c) => {
  const id = Number(c.req.param('id'))
  if (id === c.get('sessao').sub) return c.json({ erro: 'Você não pode remover a si mesmo' }, 400)
  await c.env.DB.prepare('DELETE FROM usuarios WHERE id = ? AND tenant_id = ?').bind(id, c.get('sessao').tid).run()
  return c.json({ ok: true })
})

app.get('/dashboard', async (c) => {
  const tid = c.get('sessao').tid
  const dia = hoje()
  const mes = mesAtual()
  const seteDias = hoje(new Date(Date.now() - 6 * 86400000))
  const db = c.env.DB
  const [clientes, campanhas, telas, motoristas, fin, exib, serie, mrr] = await db.batch([
    db.prepare("SELECT COUNT(*) AS n FROM clientes WHERE tenant_id = ? AND status = 'ativo'").bind(tid),
    db.prepare("SELECT COUNT(*) AS n FROM campanhas WHERE tenant_id = ? AND status = 'ativa'").bind(tid),
    db.prepare(
      "SELECT COUNT(*) AS n, SUM(CASE WHEN ultimo_ping >= datetime('now', '-10 minutes') THEN 1 ELSE 0 END) AS online FROM telas WHERE tenant_id = ? AND status = 'ativa'",
    ).bind(tid),
    db.prepare("SELECT COUNT(*) AS n FROM motoristas WHERE tenant_id = ? AND status = 'ativo'").bind(tid),
    db.prepare(
      `SELECT
         SUM(CASE WHEN status = 'aberta' THEN valor ELSE 0 END) AS a_receber,
         SUM(CASE WHEN status = 'aberta' AND vencimento < ? THEN valor ELSE 0 END) AS vencido,
         SUM(CASE WHEN status = 'paga' AND substr(pago_em, 1, 7) = ? THEN valor ELSE 0 END) AS recebido_mes
       FROM faturas WHERE tenant_id = ?`,
    ).bind(dia, mes, tid),
    db.prepare('SELECT COALESCE(SUM(total), 0) AS hoje FROM exibicoes WHERE tenant_id = ? AND dia = ?').bind(tid, dia),
    db.prepare('SELECT dia, SUM(total) AS total, SUM(qr) AS qr FROM exibicoes WHERE tenant_id = ? AND dia >= ? GROUP BY dia ORDER BY dia').bind(tid, seteDias),
    db.prepare("SELECT COALESCE(SUM(valor_mensal), 0) AS v FROM clientes WHERE tenant_id = ? AND status = 'ativo'").bind(tid),
  ])
  const um = (r: D1Result) => (r.results[0] || {}) as Record<string, number>
  return c.json({
    clientes: um(clientes).n || 0,
    campanhas: um(campanhas).n || 0,
    telas: um(telas).n || 0,
    telas_online: um(telas).online || 0,
    motoristas: um(motoristas).n || 0,
    a_receber: um(fin).a_receber || 0,
    vencido: um(fin).vencido || 0,
    recebido_mes: um(fin).recebido_mes || 0,
    receita_recorrente: um(mrr).v || 0,
    exibicoes_hoje: um(exib).hoje || 0,
    serie_7dias: serie.results,
  })
})

app.get('/relatorios', async (c) => {
  const tid = c.get('sessao').tid
  const de = c.req.query('de') || hoje(new Date(Date.now() - 29 * 86400000))
  const ate = c.req.query('ate') || hoje()
  const { results } = await c.env.DB.prepare(
    `SELECT cp.id, cp.nome, cl.nome AS cliente, cp.status,
            COALESCE(SUM(e.total), 0) AS exibicoes, COALESCE(SUM(e.qr), 0) AS qr,
            COUNT(DISTINCT e.tela_id) AS telas, COUNT(DISTINCT e.dia) AS dias
       FROM campanhas cp
       LEFT JOIN clientes cl ON cl.id = cp.cliente_id
       LEFT JOIN exibicoes e ON e.campanha_id = cp.id AND e.dia BETWEEN ? AND ?
      WHERE cp.tenant_id = ?
      GROUP BY cp.id ORDER BY exibicoes DESC`,
  )
    .bind(de, ate, tid)
    .all()
  return c.json({ de, ate, campanhas: results })
})

app.get('/relatorios/campanha/:id', async (c) => {
  const tid = c.get('sessao').tid
  const id = Number(c.req.param('id'))
  const de = c.req.query('de') || hoje(new Date(Date.now() - 29 * 86400000))
  const ate = c.req.query('ate') || hoje()
  const db = c.env.DB
  const [porDia, porTela] = await db.batch([
    db.prepare('SELECT dia, SUM(total) AS total, SUM(qr) AS qr FROM exibicoes WHERE tenant_id = ? AND campanha_id = ? AND dia BETWEEN ? AND ? GROUP BY dia ORDER BY dia').bind(tid, id, de, ate),
    db.prepare(
      'SELECT t.nome, t.tipo, t.bairro, SUM(e.total) AS total, SUM(e.qr) AS qr FROM exibicoes e JOIN telas t ON t.id = e.tela_id WHERE e.tenant_id = ? AND e.campanha_id = ? AND e.dia BETWEEN ? AND ? GROUP BY t.id ORDER BY total DESC',
    ).bind(tid, id, de, ate),
  ])
  return c.json({ de, ate, por_dia: porDia.results, por_tela: porTela.results })
})

app.get('/financeiro', async (c) => {
  const tid = c.get('sessao').tid
  const mes = c.req.query('mes') || mesAtual()
  const db = c.env.DB
  const [receitas, lanc, repasses] = await db.batch([
    db.prepare("SELECT COALESCE(SUM(valor), 0) AS v, COUNT(*) AS n FROM faturas WHERE tenant_id = ? AND status = 'paga' AND substr(pago_em, 1, 7) = ?").bind(tid, mes),
    db.prepare('SELECT * FROM lancamentos WHERE tenant_id = ? AND substr(data, 1, 7) = ? ORDER BY data DESC').bind(tid, mes),
    db.prepare(
      `SELECT m.id, m.nome, m.pix, m.repasse_fixo, m.nivel, COUNT(t.id) AS telas
         FROM motoristas m JOIN telas t ON t.motorista_id = m.id AND t.status = 'ativa'
        WHERE m.tenant_id = ? AND m.status = 'ativo' GROUP BY m.id ORDER BY m.nome`,
    ).bind(tid),
  ])
  const lancs = lanc.results as { tipo: string; valor: number }[]
  const entradas = lancs.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + Number(l.valor), 0)
  const saidas = lancs.filter((l) => l.tipo === 'saida').reduce((s, l) => s + Number(l.valor), 0)
  const rep = repasses.results as { repasse_fixo: number }[]
  const totalRepasses = rep.reduce((s, r) => s + Number(r.repasse_fixo), 0)
  const rec = (receitas.results[0] || {}) as { v: number; n: number }
  return c.json({
    mes,
    receitas_faturas: rec.v,
    faturas_pagas: rec.n,
    outras_entradas: entradas,
    saidas,
    repasses_motoristas: totalRepasses,
    resultado: rec.v + entradas - saidas - totalRepasses,
    lancamentos: lancs,
    repasses: rep,
  })
})

app.get('/cobranca', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT f.*, cl.nome AS cliente, cl.telefone, cl.email,
            CAST(julianday(?) - julianday(f.vencimento) AS INTEGER) AS dias_atraso
       FROM faturas f JOIN clientes cl ON cl.id = f.cliente_id
      WHERE f.tenant_id = ? AND f.status = 'aberta'
      ORDER BY f.vencimento`,
  )
    .bind(hoje(), c.get('sessao').tid)
    .all()
  return c.json(results)
})

// Gera as faturas do mês para todos os clientes ativos com mensalidade (não duplica).
app.post('/faturas/gerar', async (c) => {
  const tid = c.get('sessao').tid
  const { competencia } = await c.req.json<{ competencia?: string }>().catch(() => ({ competencia: undefined }))
  const comp = /^\d{4}-\d{2}$/.test(competencia || '') ? competencia! : mesAtual()
  const { results } = await c.env.DB.prepare("SELECT id, nome, plano, valor_mensal, dia_vencimento FROM clientes WHERE tenant_id = ? AND status = 'ativo' AND valor_mensal > 0")
    .bind(tid)
    .all<{ id: number; nome: string; plano: string | null; valor_mensal: number; dia_vencimento: number }>()
  if (!results.length) return c.json({ criadas: 0 })
  const stmt = c.env.DB.prepare(
    "INSERT OR IGNORE INTO faturas (tenant_id, cliente_id, descricao, competencia, valor, vencimento, status) VALUES (?, ?, ?, ?, ?, ?, 'aberta')",
  )
  const res = await c.env.DB.batch(
    results.map((cl) => {
      const dia = String(Math.min(Math.max(cl.dia_vencimento || 10, 1), 28)).padStart(2, '0')
      return stmt.bind(tid, cl.id, `${cl.plano || 'Mensalidade'} ${comp.slice(5)}/${comp.slice(0, 4)}`, comp, cl.valor_mensal, `${comp}-${dia}`)
    }),
  )
  return c.json({ criadas: res.reduce((s, r) => s + (r.meta.changes || 0), 0), competencia: comp })
})

app.post('/faturas/:id/pagar', async (c) => {
  const { forma } = await c.req.json<{ forma?: string }>().catch(() => ({ forma: undefined }))
  await c.env.DB.prepare("UPDATE faturas SET status = 'paga', pago_em = ?, forma_pagamento = ? WHERE id = ? AND tenant_id = ?")
    .bind(hoje(), forma || 'pix', Number(c.req.param('id')), c.get('sessao').tid)
    .run()
  return c.json({ ok: true })
})

// CRUD genérico por último, para não capturar as rotas específicas acima.
app.route('/', crud)
