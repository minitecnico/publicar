import { Hono } from 'hono'
import { conferirSenha, emitirToken, exigirAdmin, exigirLogin, hashSenha } from './auth'
import { cteAudiencia, investimentoNoPeriodo, metricas, padroesAudiencia, SQL_ALCANCE, SQL_IMPACTOS } from './audiencia'
import { cron, enviarAlerta } from './alertas'
import { anexarMetricasPacotes, audienciaTela, pacotesSugeridos } from './pacotes'
import { crud } from './crud'
import { portal } from './portal'
import { novoToken, relatorioCampanha } from './relatorio'
import { carregarGrade, configCiclo, ocupacao, rodaNaTela, segundosNoCiclo, verificarCampanha } from './grade'
import { enviarMidia, servirMidia } from './media'
import { loja, redirecionarQr } from './leads'
import { player } from './player'
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

// Relatório público da campanha pelo link (sem login). Período: início da campanha (até 90 dias atrás) até hoje.
app.get('/publico/campanha/:token', async (c) => {
  const token = c.req.param('token')
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return c.json({ erro: 'Link inválido' }, 404)
  const cp = await c.env.DB.prepare(
    `SELECT cp.id, cp.tenant_id, cp.nome, cp.status, cp.inicio, cp.fim, cl.nome AS cliente, t.nome AS empresa
       FROM campanhas cp JOIN tenants t ON t.id = cp.tenant_id LEFT JOIN clientes cl ON cl.id = cp.cliente_id
      WHERE cp.token_publico = ?`,
  )
    .bind(token)
    .first<{ id: number; tenant_id: string; nome: string; status: string; inicio: string | null; fim: string | null; cliente: string | null; empresa: string }>()
  if (!cp) return c.json({ erro: 'Link expirado ou revogado. Peça um novo link à empresa.' }, 404)
  const limite = hoje(new Date(Date.now() - 89 * 86400000))
  const ate = cp.fim && cp.fim < hoje() ? cp.fim : hoje()
  const de = cp.inicio && cp.inicio > limite ? cp.inicio : limite
  const r = await relatorioCampanha(c.env.DB, cp.tenant_id, cp.id, de, ate)
  c.header('Cache-Control', 'no-store')
  return c.json({
    campanha: { nome: cp.nome, status: cp.status, inicio: cp.inicio, fim: cp.fim, cliente: cp.cliente, empresa: cp.empresa },
    gerado_em: new Date().toISOString(),
    ...r,
    // valores financeiros ficam só no painel
    resumo: r ? { ...r.resumo, investimento: undefined, cpm: undefined } : null,
    cupons: r?.cupons ? { ...r.cupons, retorno: undefined } : null,
  })
})

// Mídia kit público da empresa (link sem login): números do dia, bairros, pacotes e especificações.
app.get('/publico/midiakit/:token', async (c) => {
  const token = c.req.param('token')
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return c.json({ erro: 'Link inválido' }, 404)
  const db = c.env.DB
  const t = await db.prepare("SELECT id, nome, config FROM tenants WHERE json_extract(config, '$.token_midiakit') = ?").bind(token).first<{ id: string; nome: string; config: string }>()
  if (!t) return c.json({ erro: 'Mídia kit indisponível. Peça um novo link.' }, 404)
  let cfg: Record<string, any> = {}
  try { cfg = JSON.parse(t.config || '{}') } catch { /* vazio */ }
  const [telasRes, pacotesRes, padroes] = await Promise.all([
    db.prepare("SELECT * FROM telas WHERE tenant_id = ? AND status = 'ativa'").bind(t.id).all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM pacotes WHERE tenant_id = ? AND status = 'ativo' ORDER BY preco_base").bind(t.id).all<Record<string, unknown>>(),
    padroesAudiencia(db, t.id),
  ])
  const telas = telasRes.results
  const bairros = new Map<string, { bairro: string; carros: number; estabelecimentos: number; pessoas_dia: number }>()
  let pessoasDia = 0
  for (const tela of telas) {
    const a = audienciaTela(tela, padroes)
    pessoasDia += a.pessoas
    const k = String(tela.bairro || '').trim() || 'Outros'
    const b = bairros.get(k) || { bairro: k, carros: 0, estabelecimentos: 0, pessoas_dia: 0 }
    if (tela.tipo === 'carro') b.carros++
    else b.estabelecimentos++
    b.pessoas_dia += a.pessoas
    bairros.set(k, b)
  }
  const pacotes = pacotesRes.results
  for (const p of pacotes) p.bairros = JSON.parse(String(p.bairros || '[]'))
  await anexarMetricasPacotes(db, t.id, pacotes)
  c.header('Cache-Control', 'no-store')
  return c.json({
    empresa: t.nome,
    cidade: cfg.cidade || null,
    whatsapp: cfg.whatsapp || null,
    telas: { total: telas.length, carros: telas.filter((x) => x.tipo === 'carro').length, estabelecimentos: telas.filter((x) => x.tipo !== 'carro').length },
    pessoas_dia: Math.round(pessoasDia),
    pessoas_mes: Math.round(pessoasDia * 30),
    bairros: [...bairros.values()].map((b) => ({ ...b, pessoas_dia: Math.round(b.pessoas_dia) })).sort((a, b) => b.pessoas_dia - a.pessoas_dia),
    pacotes: pacotes.map((p) => {
      const m = (p.metricas || {}) as Record<string, unknown>
      return {
        nome: p.nome, descricao: p.descricao, duracao: p.duracao, prioridade: p.prioridade, horarios: JSON.parse(String(p.horarios || '[]')), dias_semana: JSON.parse(String(p.dias_semana || '[]')),
        telas: m.telas, bairros: m.bairros, pessoas_dia: m.pessoas_dia, impactos_mes: m.impactos_mes, preco: m.preco_sugerido, cpm: m.cpm, ocupacao: m.ocupacao,
      }
    }),
    ciclo: { segundos: Number(cfg.ciclo_segundos) || 120, conteudo_pct: Number(cfg.conteudo_pct) || 0 },
  })
})

app.route('/player', player)
app.route('/r', redirecionarQr)
app.route('/publico/loja', loja)
app.route('/cron', cron)
app.route('/publico/portal', portal)
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
  // chaves controladas só pelo servidor (links públicos) não são sobrescritas pelo formulário
  const atual = await c.env.DB.prepare('SELECT config FROM tenants WHERE id = ?').bind(c.get('sessao').tid).first<{ config: string }>()
  let antes: Record<string, unknown> = {}
  try { antes = JSON.parse(atual?.config || '{}') } catch { /* vazio */ }
  const novo = { ...(config || {}), token_midiakit: antes.token_midiakit }
  await c.env.DB.prepare('UPDATE tenants SET nome = ?, modulos = ?, config = ? WHERE id = ?')
    .bind(nome, JSON.stringify(modulos || []), JSON.stringify(novo), c.get('sessao').tid)
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
  const cte = cteAudiencia(await padroesAudiencia(db, tid), tid)
  const [clientes, campanhas, telas, motoristas, fin, exib, serie, mrr] = await db.batch([
    db.prepare("SELECT COUNT(*) AS n FROM clientes WHERE tenant_id = ? AND status = 'ativo'").bind(tid),
    db.prepare("SELECT COUNT(*) AS n FROM campanhas WHERE tenant_id = ? AND status = 'ativa'").bind(tid),
    db.prepare(
      "SELECT COUNT(*) AS n, SUM(CASE WHEN ultimo_ping >= datetime('now', '-25 minutes') THEN 1 ELSE 0 END) AS online FROM telas WHERE tenant_id = ? AND status = 'ativa'",
    ).bind(tid),
    db.prepare("SELECT COUNT(*) AS n FROM motoristas WHERE tenant_id = ? AND status = 'ativo'").bind(tid),
    db.prepare(
      `SELECT
         SUM(CASE WHEN status = 'aberta' THEN valor ELSE 0 END) AS a_receber,
         SUM(CASE WHEN status = 'aberta' AND vencimento < ? THEN valor ELSE 0 END) AS vencido,
         SUM(CASE WHEN status = 'paga' AND substr(pago_em, 1, 7) = ? THEN valor ELSE 0 END) AS recebido_mes
       FROM faturas WHERE tenant_id = ?`,
    ).bind(dia, mes, tid),
    db.prepare(`${cte.sql} SELECT COALESCE(SUM(e.total), 0) AS hoje, ${SQL_IMPACTOS} AS impactos FROM exibicoes e LEFT JOIN aud a ON a.id = e.tela_id WHERE e.tenant_id = ? AND e.dia = ?`).bind(...cte.binds, tid, dia),
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
    impactos_hoje: Math.round(um(exib).impactos || 0),
    serie_7dias: serie.results,
  })
})

app.get('/relatorios', async (c) => {
  const tid = c.get('sessao').tid
  const de = c.req.query('de') || hoje(new Date(Date.now() - 29 * 86400000))
  const ate = c.req.query('ate') || hoje()
  const cte = cteAudiencia(await padroesAudiencia(c.env.DB, tid), tid)
  const { results } = await c.env.DB.prepare(
    `${cte.sql}
     SELECT cp.id, cp.nome, cl.nome AS cliente, cp.status, cp.valor, cp.inicio, cp.fim, cp.token_publico, cp.token_loja, cp.cupom_oferta,
            COALESCE(SUM(e.total), 0) AS exibicoes, COALESCE(SUM(e.qr), 0) AS qr,
            COUNT(DISTINCT e.tela_id) AS telas, COUNT(DISTINCT e.dia) AS dias,
            ${SQL_IMPACTOS} AS impactos, ${SQL_ALCANCE} AS alcance
       FROM campanhas cp
       LEFT JOIN clientes cl ON cl.id = cp.cliente_id
       LEFT JOIN exibicoes e ON e.campanha_id = cp.id AND e.dia BETWEEN ? AND ?
       LEFT JOIN aud a ON a.id = e.tela_id
      WHERE cp.tenant_id = ?
      GROUP BY cp.id ORDER BY impactos DESC, exibicoes DESC`,
  )
    .bind(...cte.binds, de, ate, tid)
    .all<Record<string, any>>()
  const campanhas = results.map((r) => ({ ...r, ...metricas(r as any, investimentoNoPeriodo(r.valor, r.inicio, r.fim, de, ate)) }))
  return c.json({ de, ate, campanhas })
})

app.get('/relatorios/campanha/:id', async (c) => {
  const tid = c.get('sessao').tid
  const de = c.req.query('de') || hoje(new Date(Date.now() - 29 * 86400000))
  const ate = c.req.query('ate') || hoje()
  const r = await relatorioCampanha(c.env.DB, tid, Number(c.req.param('id')), de, ate)
  return r ? c.json(r) : c.json({ erro: 'Campanha não encontrada' }, 404)
})

// Link público do relatório (anunciante acompanha sem login). Gera se ainda não existir.
app.post('/campanhas/:id/link', async (c) => {
  const tid = c.get('sessao').tid
  const id = Number(c.req.param('id'))
  const atual = await c.env.DB.prepare('SELECT token_publico FROM campanhas WHERE id = ? AND tenant_id = ?').bind(id, tid).first<{ token_publico: string | null }>()
  if (!atual) return c.json({ erro: 'Campanha não encontrada' }, 404)
  if (atual.token_publico) return c.json({ token: atual.token_publico })
  const token = novoToken()
  await c.env.DB.prepare('UPDATE campanhas SET token_publico = ? WHERE id = ? AND tenant_id = ?').bind(token, id, tid).run()
  return c.json({ token })
})

// Link público do mídia kit (gera uma vez; "novo" = troca o link e invalida o anterior).
app.post('/midiakit/link', exigirAdmin, async (c) => {
  const tid = c.get('sessao').tid
  const { novo } = await c.req.json<{ novo?: boolean }>().catch(() => ({ novo: false }))
  const t = await c.env.DB.prepare('SELECT config FROM tenants WHERE id = ?').bind(tid).first<{ config: string }>()
  let cfg: Record<string, unknown> = {}
  try { cfg = JSON.parse(t?.config || '{}') } catch { /* vazio */ }
  if (!cfg.token_midiakit || novo) {
    cfg.token_midiakit = novoToken()
    await c.env.DB.prepare('UPDATE tenants SET config = ? WHERE id = ?').bind(JSON.stringify(cfg), tid).run()
  }
  return c.json({ token: cfg.token_midiakit })
})

// Link do portal do anunciante (gera uma vez; DELETE revoga).
app.post('/clientes/:id/portal', async (c) => {
  const tid = c.get('sessao').tid
  const id = Number(c.req.param('id'))
  const atual = await c.env.DB.prepare('SELECT token_portal FROM clientes WHERE id = ? AND tenant_id = ?').bind(id, tid).first<{ token_portal: string | null }>()
  if (!atual) return c.json({ erro: 'Cliente não encontrado' }, 404)
  if (atual.token_portal) return c.json({ token: atual.token_portal })
  const token = novoToken()
  await c.env.DB.prepare('UPDATE clientes SET token_portal = ? WHERE id = ? AND tenant_id = ?').bind(token, id, tid).run()
  return c.json({ token })
})
app.delete('/clientes/:id/portal', async (c) => {
  await c.env.DB.prepare('UPDATE clientes SET token_portal = NULL WHERE id = ? AND tenant_id = ?').bind(Number(c.req.param('id')), c.get('sessao').tid).run()
  return c.json({ ok: true })
})

// Cria os pacotes sugeridos (Cidade, Bairro, Horário nobre) se a empresa ainda não tem nenhum.
app.post('/pacotes/sugeridos', async (c) => {
  const tid = c.get('sessao').tid
  const db = c.env.DB
  const n = await db.prepare('SELECT COUNT(*) AS n FROM pacotes WHERE tenant_id = ?').bind(tid).first<{ n: number }>()
  if (n?.n) return c.json({ criados: 0 })
  const top = await db
    .prepare("SELECT bairro, COUNT(*) AS n FROM telas WHERE tenant_id = ? AND status = 'ativa' AND TRIM(COALESCE(bairro, '')) <> '' GROUP BY bairro ORDER BY n DESC LIMIT 1")
    .bind(tid)
    .first<{ bairro: string }>()
  const stmt = db.prepare(
    'INSERT INTO pacotes (tenant_id, nome, descricao, tipo_tela, bairros, duracao, prioridade, dias_semana, horarios, preco_base, dinamico) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
  const lista = pacotesSugeridos(top?.bairro?.trim() || null)
  await db.batch(lista.map((p) => stmt.bind(tid, p.nome, p.descricao, p.tipo_tela, p.bairros, p.duracao, p.prioridade, p.dias_semana, p.horarios, p.preco_base, p.dinamico)))
  return c.json({ criados: lista.length })
})

// Envia uma mensagem de teste com a configuração de alertas (sem salvar).
app.post('/alertas/teste', exigirAdmin, async (c) => {
  const cfg = await c.req.json<Record<string, unknown>>()
  const ok = await enviarAlerta(cfg, '✅ Publicar: alertas de tela offline configurados.')
  return ok ? c.json({ ok: true }) : c.json({ erro: 'Não foi possível enviar. Confira o número e a apikey do CallMeBot (ou o webhook).' }, 400)
})

// Link da loja para validar cupons (sem login).
app.post('/campanhas/:id/link-loja', async (c) => {
  const tid = c.get('sessao').tid
  const id = Number(c.req.param('id'))
  const atual = await c.env.DB.prepare('SELECT token_loja FROM campanhas WHERE id = ? AND tenant_id = ?').bind(id, tid).first<{ token_loja: string | null }>()
  if (!atual) return c.json({ erro: 'Campanha não encontrada' }, 404)
  if (atual.token_loja) return c.json({ token: atual.token_loja })
  const token = novoToken()
  await c.env.DB.prepare('UPDATE campanhas SET token_loja = ? WHERE id = ? AND tenant_id = ?').bind(token, id, tid).run()
  return c.json({ token })
})
app.delete('/campanhas/:id/link-loja', async (c) => {
  await c.env.DB.prepare('UPDATE campanhas SET token_loja = NULL WHERE id = ? AND tenant_id = ?').bind(Number(c.req.param('id')), c.get('sessao').tid).run()
  return c.json({ ok: true })
})

// Revoga o link (o anterior deixa de funcionar).
app.delete('/campanhas/:id/link', async (c) => {
  await c.env.DB.prepare('UPDATE campanhas SET token_publico = NULL WHERE id = ? AND tenant_id = ?').bind(Number(c.req.param('id')), c.get('sessao').tid).run()
  return c.json({ ok: true })
})

app.get('/financeiro', async (c) => {
  const tid = c.get('sessao').tid
  const mes = c.req.query('mes') || mesAtual()
  const db = c.env.DB
  const [receitas, lanc, repasses, tenant] = await db.batch([
    db.prepare("SELECT COALESCE(SUM(valor), 0) AS v, COUNT(*) AS n FROM faturas WHERE tenant_id = ? AND status = 'paga' AND substr(pago_em, 1, 7) = ?").bind(tid, mes),
    db.prepare('SELECT * FROM lancamentos WHERE tenant_id = ? AND substr(data, 1, 7) = ? ORDER BY data DESC').bind(tid, mes),
    db.prepare(
      `SELECT m.id, m.nome, m.pix, m.repasse_fixo, m.nivel, m.modelo_repasse, m.valor_hora,
              COUNT(DISTINCT t.id) AS telas,
              COALESCE((SELECT SUM(a.minutos) FROM atividade a JOIN telas t2 ON t2.id = a.tela_id
                         WHERE t2.motorista_id = m.id AND substr(a.dia, 1, 7) = ?), 0) AS minutos
         FROM motoristas m JOIN telas t ON t.motorista_id = m.id AND t.status = 'ativa'
        WHERE m.tenant_id = ? AND m.status = 'ativo' GROUP BY m.id ORDER BY m.nome`,
    ).bind(mes, tid),
    db.prepare('SELECT config FROM tenants WHERE id = ?').bind(tid),
  ])
  const lancs = lanc.results as { tipo: string; valor: number }[]
  const entradas = lancs.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + Number(l.valor), 0)
  const saidas = lancs.filter((l) => l.tipo === 'saida').reduce((s, l) => s + Number(l.valor), 0)
  // repasse: fixo, ou horas de tela ligada × valor/hora com bônus do nível (incentiva manter o tablet ligado)
  let bonus: Record<string, number> = { bronze: 0, prata: 10, ouro: 20 }
  try {
    const b = JSON.parse(((tenant.results[0] || {}) as { config: string }).config || '{}').bonus_nivel
    if (b && typeof b === 'object') bonus = { ...bonus, ...b }
  } catch { /* padrão */ }
  const rep = (repasses.results as { repasse_fixo: number; nivel: string; modelo_repasse: string; valor_hora: number | null; minutos: number }[]).map((r) => {
    const horas = Math.round((Number(r.minutos) / 60) * 10) / 10
    const pct = Number(bonus[r.nivel]) || 0
    const valor = r.modelo_repasse === 'hora' ? Math.round(horas * (Number(r.valor_hora) || 0) * (1 + pct / 100) * 100) / 100 : Number(r.repasse_fixo) || 0
    return { ...r, horas, bonus_pct: r.modelo_repasse === 'hora' ? pct : 0, valor }
  })
  const totalRepasses = rep.reduce((s, r) => s + r.valor, 0)
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

/* -------------------------------------------------------------- inventário */

// Prévia no formulário: a campanha cabe no ciclo? (não grava nada)
app.post('/campanhas/verificar', async (c) => {
  const corpo = await c.req.json<Record<string, unknown>>()
  const id = Number(corpo.id) || undefined
  return c.json(await verificarCampanha(c.env.DB, c.get('sessao').tid, { ...corpo, status: corpo.status || 'aguardando' }, id))
})

// Mapa de ocupação de um dia: segundos vendidos por tela em cada hora.
app.get('/inventario', async (c) => {
  const tid = c.get('sessao').tid
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('data') || '') ? c.req.query('data')! : hoje()
  const dow = new Date(`${dia}T12:00:00Z`).getUTCDay()
  const [cfgCiclo, grade] = await Promise.all([configCiclo(c.env.DB, tid), carregarGrade(c.env.DB, tid)])
  const ciclo = cfgCiclo.capacidade
  const doDia = grade.campanhas.filter((cp) => (!cp.inicio || cp.inicio <= dia) && (!cp.fim || cp.fim >= dia))
  const ocup = ocupacao(grade.telas, doDia)
  return c.json({
    data: dia,
    dia_semana: dow,
    ciclo,
    ciclo_total: cfgCiclo.ciclo,
    conteudo_pct: cfgCiclo.pct,
    telas: grade.telas.map((t) => ({
      ...t,
      horas: ocup.get(t.id)!.slice(dow * 24, dow * 24 + 24),
      campanhas: doDia.filter((cp) => rodaNaTela(cp, t)).map((cp) => ({ id: cp.id, nome: cp.nome, segundos: segundosNoCiclo(cp), status: cp.status })),
    })),
  })
})

// CRUD genérico por último, para não capturar as rotas específicas acima.
app.route('/', crud)
