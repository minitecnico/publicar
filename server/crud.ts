import { Hono } from 'hono'
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
    colunas: ['nome', 'tipo', 'cliente_id', 'motorista_id', 'bairro', 'layout', 'cor_primaria', 'cor_fundo', 'logo_url', 'ticker', 'conteudo', 'status'],
    json: ['conteudo'],
    obrigatorias: ['nome'],
    aoCriar: (d) => ({ ...d, codigo: codigoTela() }),
  },
  campanhas: {
    tabela: 'campanhas',
    colunas: ['cliente_id', 'nome', 'midia_tipo', 'midia_url', 'duracao', 'link_qr', 'texto', 'inicio', 'fim', 'tipo_tela', 'telas_alvo', 'prioridade', 'status'],
    json: ['telas_alvo'],
    obrigatorias: ['nome'],
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

function deserializar(r: Recurso, row: Record<string, unknown>) {
  for (const k of r.json || []) {
    if (typeof row[k] === 'string') {
      try { row[k] = JSON.parse(row[k] as string) } catch { row[k] = [] }
    }
  }
  return row
}

function limpar(r: Recurso, corpo: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const k of r.colunas) {
    if (!(k in corpo)) continue
    let v = corpo[k]
    if ((r.json || []).includes(k)) v = JSON.stringify(v ?? [])
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
  return c.json(results.map((row) => deserializar(r, row)))
})

crud.get('/:res/:id', async (c) => {
  const r = RECURSOS[c.req.param('res')]
  if (!r) return c.notFound()
  const row = await c.env.DB.prepare(`SELECT * FROM ${r.tabela} WHERE id = ? AND tenant_id = ?`)
    .bind(Number(c.req.param('id')), c.get('sessao').tid)
    .first<Record<string, unknown>>()
  return row ? c.json(deserializar(r, row)) : c.json({ erro: 'Não encontrado' }, 404)
})

crud.post('/:res', async (c) => {
  const r = RECURSOS[c.req.param('res')]
  if (!r) return c.notFound()
  let dados = limpar(r, await c.req.json())
  for (const k of r.obrigatorias || []) if (dados[k] == null || dados[k] === '') return c.json({ erro: `Campo obrigatório: ${k}` }, 400)
  if (r.aoCriar) dados = r.aoCriar(dados)
  dados.tenant_id = c.get('sessao').tid
  const cols = Object.keys(dados)
  const row = await c.env.DB.prepare(
    `INSERT INTO ${r.tabela} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) RETURNING *`,
  )
    .bind(...cols.map((k) => dados[k]))
    .first<Record<string, unknown>>()
  return c.json(deserializar(r, row!), 201)
})

crud.put('/:res/:id', async (c) => {
  const r = RECURSOS[c.req.param('res')]
  if (!r) return c.notFound()
  const dados = limpar(r, await c.req.json())
  const cols = Object.keys(dados)
  if (!cols.length) return c.json({ erro: 'Nada para atualizar' }, 400)
  const row = await c.env.DB.prepare(
    `UPDATE ${r.tabela} SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND tenant_id = ? RETURNING *`,
  )
    .bind(...cols.map((k) => dados[k]), Number(c.req.param('id')), c.get('sessao').tid)
    .first<Record<string, unknown>>()
  return row ? c.json(deserializar(r, row)) : c.json({ erro: 'Não encontrado' }, 404)
})

crud.delete('/:res/:id', async (c) => {
  const r = RECURSOS[c.req.param('res')]
  if (!r) return c.notFound()
  await c.env.DB.prepare(`DELETE FROM ${r.tabela} WHERE id = ? AND tenant_id = ?`)
    .bind(Number(c.req.param('id')), c.get('sessao').tid)
    .run()
  return c.json({ ok: true })
})
