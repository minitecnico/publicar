import { Hono } from 'hono'
import { obterConteudo } from './conteudo'
import { configCiclo, lista, type Janela } from './grade'
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
/** Quadros de conteúdo automático disponíveis. */
export const WIDGETS = ['clima', 'cotacao', 'noticias', 'esportes', 'curiosidades']
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
  widgets: string
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
  // sinal de vida: versão do player, resolução, bateria (%), carregando (1/0) e tipo de rede
  const q = (k: string) => (c.req.query(k) || '').slice(0, 20) || null
  const bat = Number(c.req.query('b'))
  const info = JSON.stringify({
    versao: q('v'),
    tela: q('r'),
    bateria: Number.isFinite(bat) && bat >= 0 && bat <= 100 ? Math.round(bat) : null,
    carregando: c.req.query('c') === '1' ? true : c.req.query('c') === '0' ? false : null,
    rede: q('n'),
  }).slice(0, 500)
  const [, contagem] = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE telas SET ultimo_ping = datetime('now'), ultima_info = ? WHERE id = ?").bind(info, tela.id),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM telas WHERE status = 'ativa'"),
  ])
  const telasAtivas = Number((contagem.results[0] as { n: number } | undefined)?.n) || 1
  const { results } = await c.env.DB.prepare(
    `SELECT id, nome, duracao, link_qr, prioridade, rotacao, telas_alvo, dias_semana, horarios, whatsapp, cupom_oferta
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
      // chamada do QR na tela
      cta: cp.cupom_oferta ? `Aponte e ganhe ${String(cp.cupom_oferta).trim()}` : cp.whatsapp ? 'Chame no WhatsApp' : null,
      pecas: pecasPor.get(Number(cp.id))!.map((p) => ({
        id: p.id,
        tipo: p.midia_tipo,
        url: p.midia_url,
        duracao: p.duracao,
        texto: p.texto,
        peso: cp.rotacao === 'peso' ? p.peso : 1,
        ajuste: p.ajuste === 'inteira' ? 'inteira' : 'preencher',
        qr_url: p.link_qr || cp.link_qr || cp.whatsapp || cp.cupom_oferta ? `${origem}/api/r/${cp.id}/${tela.id}/${p.id}` : null,
      })),
      // dia e horário são conferidos no próprio player (ele guarda a programação e funciona offline)
      dias_semana: lista<number>(cp.dias_semana).map(Number),
      horarios: lista<Janela>(cp.horarios),
    }))
    // compatibilidade: player antigo (antes das peças) ainda lê a mídia direto da campanha até recarregar
    .map((cp) => ({ ...cp, midia_tipo: cp.pecas[0].tipo, midia_url: cp.pecas[0].url, texto: cp.pecas[0].texto, qr_url: cp.pecas[0].qr_url }))

  let conteudo: unknown[] = []
  try { conteudo = JSON.parse(tela.conteudo || '[]') } catch { /* vazio */ }

  // conteúdo automático (clima, cotações, manchetes) + patrocínios dos quadros
  const ciclo = await configCiclo(c.env.DB, tela.tenant_id)
  const widgets = lista<string>(tela.widgets).filter((w) => WIDGETS.includes(w))
  const cidade = typeof ciclo.cfg.cidade === 'string' && ciclo.cfg.cidade.trim() ? ciclo.cfg.cidade.trim() : null
  const auto = widgets.length
    ? await obterConteudo(c.env.DB, tela.tenant_id, cidade, (p) => c.executionCtx.waitUntil(p)).catch(() => null)
    : null

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
      widgets,
    },
    conteudo_auto: auto,
    patrocinios: ciclo.cfg.patrocinios && typeof ciclo.cfg.patrocinios === 'object' ? ciclo.cfg.patrocinios : {},
    campanhas,
    ciclo: ciclo.ciclo, // ciclo inteiro: a parte não vendida é preenchida com conteúdo
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

// Prova de exibição em lote:
//   itens: [{ campanha_id, dia, total, pecas: { "<peca_id>": n }, horas: { "<0-23>": n } }]   (até MAX_ITENS por envio)
// O player só conta peça exibida por completo (vídeo até o fim) e com a tela ativa.
// Limites do D1 grátis: 50 consultas por requisição e 100 parâmetros por consulta, por isso
// as gravações vão em INSERTs de várias linhas. O player manda em partes e só apaga o que foi aceito.
export const MAX_ITENS = 150
const LINHAS_EXIB = 19 // 5 parâmetros por linha + 3 fixos ≤ 100

const partes = <T,>(l: T[], n: number) => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, i * n + n))
const DIA = /^\d{4}-\d{2}-\d{2}$/

player.post('/:codigo/exibicoes', async (c) => {
  const tela = await buscarTela(c.env.DB, c.req.param('codigo'))
  if (!tela) return c.json({ erro: 'Tela não encontrada' }, 404)
  const corpo = await c.req.json<{
    itens?: { campanha_id: number; dia: string; total: number; pecas?: Record<string, number>; horas?: Record<string, number> }[]
    ativo?: { dia: string; minutos: number }[]
  }>()
  const validos = (corpo.itens || [])
    .filter((i) => Number.isInteger(i.campanha_id) && DIA.test(i.dia) && i.total > 0 && i.total < 100000)
    .slice(0, MAX_ITENS)
  const db = c.env.DB
  const stmts: D1PreparedStatement[] = []

  if (validos.length) {
    // soma peças e horas ao que já está gravado
    const dias = [...new Set(validos.map((i) => i.dia))].slice(0, 90)
    const { results: atuais } = await db
      .prepare(`SELECT campanha_id, dia, pecas, horas FROM exibicoes WHERE tela_id = ? AND dia IN (${dias.map(() => '?').join(',')})`)
      .bind(tela.id, ...dias)
      .all<{ campanha_id: number; dia: string; pecas: string; horas: string }>()
    const gravadas = new Map(atuais.map((a) => [`${a.campanha_id}|${a.dia}`, a]))
    const somar = (base: string | undefined, novos: Record<string, number> | undefined, chaveOk: (k: string) => boolean) => {
      let m: Record<string, number> = {}
      try { m = JSON.parse(base || '{}') } catch { /* recomeça */ }
      for (const [k, n] of Object.entries(novos || {})) if (chaveOk(k) && Number(n) > 0) m[k] = (Number(m[k]) || 0) + Math.round(Number(n))
      return JSON.stringify(m)
    }
    const linhas = validos.map((i) => {
      const g = gravadas.get(`${i.campanha_id}|${i.dia}`)
      return [
        i.campanha_id,
        i.dia,
        Math.round(i.total),
        somar(g?.pecas, i.pecas, (k) => /^\d+$/.test(k)),
        somar(g?.horas, i.horas, (k) => /^\d{1,2}$/.test(k) && Number(k) < 24),
      ]
    })
    for (const lote of partes(linhas, LINHAS_EXIB)) {
      stmts.push(
        db.prepare(
          `INSERT INTO exibicoes (tenant_id, campanha_id, tela_id, dia, total, pecas, horas)
           SELECT ?, cp.id, ?, v.column2, v.column3, v.column4, v.column5
             FROM (VALUES ${lote.map(() => '(?, ?, ?, ?, ?)').join(', ')}) AS v
             JOIN campanhas cp ON cp.id = v.column1 AND cp.tenant_id = ?
            WHERE true
           ON CONFLICT (campanha_id, tela_id, dia) DO UPDATE SET total = total + excluded.total, pecas = excluded.pecas, horas = excluded.horas`,
        ).bind(tela.tenant_id, tela.id, ...lote.flat(), tela.tenant_id),
      )
    }
  }

  // minutos em que a tela esteve exibindo (base do repasse por hora)
  const ativo = (corpo.ativo || []).filter((a) => DIA.test(a.dia) && a.minutos > 0 && a.minutos <= 1440).slice(0, 15)
  for (const a of ativo) {
    stmts.push(
      db.prepare('INSERT INTO atividade (tela_id, dia, minutos) VALUES (?, ?, ?) ON CONFLICT (tela_id, dia) DO UPDATE SET minutos = MIN(1440, minutos + excluded.minutos)')
        .bind(tela.id, a.dia, Math.round(a.minutos)),
    )
  }

  if (stmts.length) await db.batch(stmts)
  return c.json({ ok: true, gravados: validos.length, ativo: ativo.length })
})
