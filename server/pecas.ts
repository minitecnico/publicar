/**
 * Peças (criativos) das campanhas.
 * Gravadas junto com a campanha: o corpo do POST/PUT de /campanhas pode trazer `pecas: Peca[]`,
 * e a lista enviada passa a ser a lista da campanha (insere, atualiza e remove).
 */

export interface Peca {
  id?: number
  campanha_id?: number
  nome?: string | null
  midia_tipo: string
  midia_url?: string | null
  duracao?: number | null
  texto?: string | null
  link_qr?: string | null
  peso?: number
  inicio?: string | null
  fim?: string | null
  status?: string
  ordem?: number
  /** preencher (ocupa a tela toda, corta as bordas) | inteira (sem cortar) */
  ajuste?: string
}

const TIPOS = ['imagem', 'video', 'youtube']
const STATUS = ['aguardando', 'aprovada', 'reprovada', 'pausada']

export function limparPecas(v: unknown): Peca[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((p) => p && typeof p === 'object' && (p.midia_url || '').trim())
    .slice(0, 40) // limite do D1 grátis: 50 consultas por requisição (1 por peça + leituras)
    .map((p, i) => ({
      id: Number(p.id) || undefined,
      nome: p.nome ? String(p.nome).slice(0, 120) : null,
      midia_tipo: TIPOS.includes(p.midia_tipo) ? p.midia_tipo : 'imagem',
      midia_url: String(p.midia_url).trim(),
      duracao: Number(p.duracao) > 0 ? Math.round(Number(p.duracao)) : null,
      texto: p.texto ? String(p.texto) : null,
      link_qr: p.link_qr ? String(p.link_qr).trim() : null,
      peso: Math.max(1, Math.min(10, Math.round(Number(p.peso) || 1))),
      inicio: p.inicio || null,
      fim: p.fim || null,
      status: STATUS.includes(p.status) ? p.status : 'aguardando',
      ajuste: p.ajuste === 'inteira' ? 'inteira' : 'preencher',
      ordem: i,
    }))
}

/** Regra de mercado: vídeo precisa caber no espaço comprado (a imagem usa a duração do espaço). */
export function validarPecas(pecas: Peca[], duracaoEspaco: number): string | null {
  const espaco = Math.max(5, duracaoEspaco || 15)
  const longa = pecas.find((p) => p.midia_tipo !== 'imagem' && (p.duracao || 0) > espaco)
  if (longa)
    return `A peça "${longa.nome || longa.midia_url}" tem ${longa.duracao}s, mas o espaço contratado é de ${espaco}s. Edite o vídeo ou aumente a duração do espaço.`
  return null
}

/** Sincroniza as peças da campanha com a lista enviada. */
export async function salvarPecas(db: D1Database, tid: string, campanhaId: number, pecas: Peca[]) {
  const { results } = await db.prepare('SELECT id FROM pecas WHERE campanha_id = ? AND tenant_id = ?').bind(campanhaId, tid).all<{ id: number }>()
  const existentes = new Set(results.map((r) => r.id))
  const manter = new Set(pecas.filter((p) => p.id && existentes.has(p.id)).map((p) => p.id))
  const stmts: D1PreparedStatement[] = []
  for (const id of existentes) if (!manter.has(id)) stmts.push(db.prepare('DELETE FROM pecas WHERE id = ? AND tenant_id = ?').bind(id, tid))
  for (const p of pecas) {
    const v = [p.nome, p.midia_tipo, p.midia_url, p.duracao, p.texto, p.link_qr, p.peso, p.inicio, p.fim, p.status, p.ajuste || 'preencher', p.ordem]
    if (p.id && existentes.has(p.id)) {
      stmts.push(
        db.prepare(
          'UPDATE pecas SET nome = ?, midia_tipo = ?, midia_url = ?, duracao = ?, texto = ?, link_qr = ?, peso = ?, inicio = ?, fim = ?, status = ?, ajuste = ?, ordem = ? WHERE id = ? AND tenant_id = ?',
        ).bind(...v, p.id, tid),
      )
    } else {
      stmts.push(
        db.prepare(
          'INSERT INTO pecas (nome, midia_tipo, midia_url, duracao, texto, link_qr, peso, inicio, fim, status, ajuste, ordem, campanha_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).bind(...v, campanhaId, tid),
      )
    }
  }
  if (stmts.length) await db.batch(stmts)
}

/** Anexa `pecas` a cada campanha da lista. */
export async function anexarPecas(db: D1Database, tid: string, campanhas: Record<string, unknown>[]) {
  if (!campanhas.length) return
  const { results } = await db.prepare('SELECT * FROM pecas WHERE tenant_id = ? ORDER BY campanha_id, ordem, id').bind(tid).all<Record<string, unknown>>()
  const por = new Map<number, Record<string, unknown>[]>()
  for (const p of results) {
    const k = Number(p.campanha_id)
    if (!por.has(k)) por.set(k, [])
    por.get(k)!.push(p)
  }
  for (const c of campanhas) c.pecas = por.get(Number(c.id)) || []
}
