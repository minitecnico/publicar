import { Hono } from 'hono'
import { mensagemConflito, verificarCampanha } from './grade'
import { anexarPecas, limparPecas, salvarPecas, validarPecas, type Peca } from './pecas'
import type { AppEnv } from './types'

/**
 * CRUD genérico com lista branca de colunas por recurso.
 * Adicionar um módulo novo = acrescentar uma entrada aqui + uma tabela na migration.
 */
interface Recurso {
  tabela: string
  colunas: string[]
  json?: string[]
  obrigatorias?: string[]
  aoCriar?: (dados: Record<string, unknown>) => Record<string, unknown>
  /** Regra de negócio antes de gravar: devolve a mensagem de erro (HTTP 409) ou null. */
  validar?: (db: D1Database, tid: string, dados: Record<string, unknown>, id: number | undefined, corpo: Record<string, unknown>) => Promise<string | null>
  /** Depois de gravar: registros filhos que vêm no mesmo corpo (ex.: peças da campanha). */
  depoisDeGravar?: (db: D1Database, tid: string, id: number, corpo: Record<string, unknown>) => Promise<void>
  /** Ao ler: completa as linhas (ex.: anexa as peças). */
  aoLer?: (db: D1Database, tid: string, linhas: Record<string, unknown>[]) => Promise<void>
}

function codigoTela(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const r = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(r, (n) => alfabeto[n % alfabeto.length]).join('')
}

export const RECURSOS: Record<string, Recurso> = {
  clientes: {
    tabela: 'clientes',
    colunas: ['tipo', 'nome', 'documento', 'contato', 'telefone', 'email', 'endereco', 'bairro', 'cidade', 'segmento', 'plano', 'valor_mensal', 'dia_vencimento', 'modulos', 'status', 'observacoes'],
    json: ['modulos'],
    obrigatorias: ['nome'],
  },
  motoristas: {
    tabela: 'motoristas',
    colunas: ['nome', 'cpf', 'telefone', 'pix', 'veiculo', 'placa', 'apps', 'repasse_fixo', 'nivel', 'status'],
    obrigatorias: ['nome'],
  },
  telas: {
    tabela: 'telas',
    colunas: [
      'nome', 'tipo', 'cliente_id', 'motorista_id', 'bairro', 'layout', 'cor_primaria', 'cor_fundo', 'logo_url', 'ticker', 'conteudo', 'status',
      'corridas_dia', 'passageiros_corrida', 'fluxo_dia', 'permanencia_min', 'horas_operacao', 'local',
    ],
    json: ['conteudo', 'local'],
    obrigatorias: ['nome'],
    aoCriar: (d) => ({ ...d, codigo: codigoTela() }),
  },
  campanhas: {
    tabela: 'campanhas',
    colunas: ['cliente_id', 'nome', 'midia_tipo', 'midia_url', 'duracao', 'link_qr', 'texto', 'inicio', 'fim', 'tipo_tela', 'telas_alvo', 'dias_semana', 'horarios', 'prioridade', 'rotacao', 'status', 'valor', 'geo'],
    json: ['telas_alvo', 'dias_semana', 'horarios', 'geo'],
    obrigatorias: ['nome'],
    validar: async (db, tid, dados, id, corpo) => {
      // vídeo das peças precisa caber no espaço comprado
      let duracao = Number(dados.duracao)
      if (!duracao && id) duracao = Number((await db.prepare('SELECT duracao FROM campanhas WHERE id = ?').bind(id).first<{ duracao: number }>())?.duracao)
      let pecas: Peca[] | null = 'pecas' in corpo ? limparPecas(corpo.pecas) : null
      if (!pecas && id && 'duracao' in dados) {
        const { results } = await db.prepare('SELECT * FROM pecas WHERE campanha_id = ? AND tenant_id = ?').bind(id, tid).all<Peca>()
        pecas = results
      }
      const erroPeca = pecas ? validarPecas(pecas, duracao) : null
      if (erroPeca) return erroPeca
      // inventário: não deixa vender além do ciclo de anúncios
      return mensagemConflito(await verificarCampanha(db, tid, dados, id, true))
    },
    depoisDeGravar: async (db, tid, id, corpo) => {
      if ('pecas' in corpo) await salvarPecas(db, tid, id, limparPecas(corpo.pecas))
    },
    aoLer: anexarPecas,
  },
  faturas: {
    tabela: 'faturas',
    colunas: ['cliente_id', 'descricao', 'competencia', 'valor', 'vencimento', 'status', 'pago_em', 'forma_pagamento'],
    obrigatorias: ['cliente_id', 'vencimento'],
  },
  lancamentos: {
    tabela: 'lancamentos',
    colunas: ['tipo', 'categoria', 'descricao', 'valor', 'data'],
    obrigatorias: ['data'],
  },
}

/** Colunas JSON que aceitam "sem valor" (null) em vez de lista vazia. */
const JSON_NULAVEL = ['geo', 'local']
/** Números opcionais: campo vazio no formulário = usa o padrão. */
const NUMERICAS_NULAVEIS = ['corridas_dia', 'passageiros_corrida', 'fluxo_dia', 'permanencia_min', 'horas_operacao', 'valor']

function deserializar(r: Recurso, row: Record<string, unknown>) {
  for (const k of r.json || []) {
    if (typeof row[k] === 'string') {
      try { row[k] = JSON.parse(row[k] as string) } catch { row[k] = JSON_NULAVEL.includes(k) ? null : [] }
    }
  }
  return row
}

function limpar(r: Recurso, corpo: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const k of r.colunas) {
    if (!(k in corpo)) continue
    let v = corpo[k]
    if ((r.json || []).includes(k)) v = v === null && JSON_NULAVEL.includes(k) ? null : JSON.stringify(v ?? [])
    else if (v === '' && NUMERICAS_NULAVEIS.includes(k)) v = null
    else if (v === '' && k.endsWith('_id')) v = null
    else if (typeof v === 'boolean') v = v ? 1 : 0
    out[k] = v ?? null
  }
  return out
}

export const crud = new Hono<AppEnv>()

crud.get('/:res', async (c) => {
  const r = RECURSOS[c.req.param('res')]
  if (!r) return c.notFound()
  const { results } = await c.env.DB.prepare(`SELECT * FROM ${r.tabela} WHERE tenant_id = ? ORDER BY id DESC LIMIT 1000`)
    .bind(c.get('sessao').tid)
    .all<Record<string, unknown>>()
  const linhas = results.map((row) => deserializar(r, row))
  if (r.aoLer) await r.aoLer(c.env.DB, c.get('sessao').tid, linhas)
  return c.json(linhas)
})

crud.get('/:res/:id', async (c) => {
  const r = RECURSOS[c.req.param('res')]
  if (!r) return c.notFound()
  const row = await c.env.DB.prepare(`SELECT * FROM ${r.tabela} WHERE id = ? AND tenant_id = ?`)
    .bind(Number(c.req.param('id')), c.get('sessao').tid)
    .first<Record<string, unknown>>()
  if (!row) return c.json({ erro: 'Não encontrado' }, 404)
  const linha = deserializar(r, row)
  if (r.aoLer) await r.aoLer(c.env.DB, c.get('sessao').tid, [linha])
  return c.json(linha)
})

crud.post('/:res', async (c) => {
  const r = RECURSOS[c.req.param('res')]
  if (!r) return c.notFound()
  const corpo = await c.req.json<Record<string, unknown>>()
  let dados = limpar(r, corpo)
  for (const k of r.obrigatorias || []) if (dados[k] == null || dados[k] === '') return c.json({ erro: `Campo obrigatório: ${k}` }, 400)
  if (r.validar) {
    const msg = await r.validar(c.env.DB, c.get('sessao').tid, dados, undefined, corpo)
    if (msg) return c.json({ erro: msg }, 409)
  }
  if (r.aoCriar) dados = r.aoCriar(dados)
  dados.tenant_id = c.get('sessao').tid
  const cols = Object.keys(dados)
  const row = await c.env.DB.prepare(
    `INSERT INTO ${r.tabela} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) RETURNING *`,
  )
    .bind(...cols.map((k) => dados[k]))
    .first<Record<string, unknown>>()
  if (r.depoisDeGravar) await r.depoisDeGravar(c.env.DB, dados.tenant_id as string, Number(row!.id), corpo)
  return c.json(deserializar(r, row!), 201)
})

crud.put('/:res/:id', async (c) => {
  const r = RECURSOS[c.req.param('res')]
  if (!r) return c.notFound()
  const corpo = await c.req.json<Record<string, unknown>>()
  const dados = limpar(r, corpo)
  const cols = Object.keys(dados)
  if (!cols.length) return c.json({ erro: 'Nada para atualizar' }, 400)
  if (r.validar) {
    const msg = await r.validar(c.env.DB, c.get('sessao').tid, dados, Number(c.req.param('id')), corpo)
    if (msg) return c.json({ erro: msg }, 409)
  }
  const row = await c.env.DB.prepare(
    `UPDATE ${r.tabela} SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND tenant_id = ? RETURNING *`,
  )
    .bind(...cols.map((k) => dados[k]), Number(c.req.param('id')), c.get('sessao').tid)
    .first<Record<string, unknown>>()
  if (!row) return c.json({ erro: 'Não encontrado' }, 404)
  if (r.depoisDeGravar) await r.depoisDeGravar(c.env.DB, c.get('sessao').tid, Number(row.id), corpo)
  return c.json(deserializar(r, row))
})

crud.delete('/:res/:id', async (c) => {
  const r = RECURSOS[c.req.param('res')]
  if (!r) return c.notFound()
  await c.env.DB.prepare(`DELETE FROM ${r.tabela} WHERE id = ? AND tenant_id = ?`)
    .bind(Number(c.req.param('id')), c.get('sessao').tid)
    .run()
  return c.json({ ok: true })
})
