import { cteAudiencia, investimentoNoPeriodo, metricas, padroesAudiencia, SQL_ALCANCE, SQL_IMPACTOS } from './audiencia'

export function novoToken() {
  const b = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Soma mapas JSON {"chave": n} guardados em várias linhas. */
function somarJson(linhas: Record<string, unknown>[], campo: string) {
  const out: Record<string, number> = {}
  for (const l of linhas) {
    try {
      for (const [k, n] of Object.entries(JSON.parse(String(l[campo] || '{}')) as Record<string, number>)) out[k] = (out[k] || 0) + Number(n)
    } catch { /* linha antiga sem o campo */ }
  }
  return out
}

/**
 * Relatório completo de uma campanha no período (painel e link público).
 * Exibições contadas pelo player só quando a peça foi exibida por completo, com a tela ativa.
 */
export async function relatorioCampanha(db: D1Database, tid: string, id: number, de: string, ate: string) {
  const padroes = await padroesAudiencia(db, tid)
  const cte = cteAudiencia(padroes, tid)
  const [porDia, porTela, linhasJson, pecas, camp, cupons] = await db.batch([
    db.prepare(
      `${cte.sql} SELECT e.dia, SUM(e.total) AS total, SUM(e.qr) AS qr, ${SQL_IMPACTOS} AS impactos, ${SQL_ALCANCE} AS alcance
         FROM exibicoes e LEFT JOIN aud a ON a.id = e.tela_id
        WHERE e.tenant_id = ? AND e.campanha_id = ? AND e.dia BETWEEN ? AND ? GROUP BY e.dia ORDER BY e.dia`,
    ).bind(...cte.binds, tid, id, de, ate),
    db.prepare(
      `${cte.sql} SELECT t.id, t.nome, t.tipo, t.bairro, SUM(e.total) AS total, SUM(e.qr) AS qr, ${SQL_IMPACTOS} AS impactos, ${SQL_ALCANCE} AS alcance
         FROM exibicoes e JOIN telas t ON t.id = e.tela_id LEFT JOIN aud a ON a.id = e.tela_id
        WHERE e.tenant_id = ? AND e.campanha_id = ? AND e.dia BETWEEN ? AND ? GROUP BY t.id ORDER BY impactos DESC`,
    ).bind(...cte.binds, tid, id, de, ate),
    db.prepare('SELECT pecas, horas, qr_horas FROM exibicoes WHERE tenant_id = ? AND campanha_id = ? AND dia BETWEEN ? AND ?').bind(tid, id, de, ate),
    db.prepare('SELECT id, nome, midia_tipo, midia_url, status FROM pecas WHERE tenant_id = ? AND campanha_id = ? ORDER BY ordem, id').bind(tid, id),
    db.prepare('SELECT valor, inicio, fim, cupom_oferta FROM campanhas WHERE id = ? AND tenant_id = ?').bind(id, tid),
    // cupons gerados no período (criado_em em UTC; a diferença de 3 h na virada do dia é desprezível aqui)
    db.prepare(
      `SELECT COUNT(*) AS gerados, COUNT(usado_em) AS usados, COALESCE(SUM(valor_venda), 0) AS vendas
         FROM cupons WHERE tenant_id = ? AND campanha_id = ? AND substr(criado_em, 1, 10) BETWEEN ? AND ?`,
    ).bind(tid, id, de, ate),
  ])
  const cp = camp.results[0] as { valor: number; inicio: string | null; fim: string | null; cupom_oferta: string | null } | undefined
  if (!cp) return null

  const json = linhasJson.results as Record<string, unknown>[]
  const somaPecas = somarJson(json, 'pecas')
  const somaHoras = somarJson(json, 'horas')
  const somaQrHoras = somarJson(json, 'qr_horas')
  const porPeca = (pecas.results as { id: number; nome: string | null; midia_tipo: string; midia_url: string; status: string }[]).map((p) => ({
    ...p,
    total: somaPecas[String(p.id)] || 0,
  }))
  const porHora = Array.from({ length: 24 }, (_, h) => ({ hora: h, total: somaHoras[String(h)] || 0, qr: somaQrHoras[String(h)] || 0 }))

  const telas = porTela.results as { bairro: string | null; total: number; qr: number; impactos: number; alcance: number }[]
  const bairros = new Map<string, { bairro: string; telas: number; total: number; qr: number; impactos: number }>()
  for (const t of telas) {
    const k = (t.bairro || '').trim() || 'Sem bairro'
    const b = bairros.get(k) || { bairro: k, telas: 0, total: 0, qr: 0, impactos: 0 }
    b.telas++
    b.total += Number(t.total) || 0
    b.qr += Number(t.qr) || 0
    b.impactos += Number(t.impactos) || 0
    bairros.set(k, b)
  }

  const dias = porDia.results as { total: number; qr: number; impactos: number; alcance: number }[]
  const soma = (k: 'total' | 'qr' | 'impactos' | 'alcance') => dias.reduce((s, d) => s + Number(d[k] || 0), 0)
  const investimento = investimentoNoPeriodo(cp.valor, cp.inicio, cp.fim, de, ate)
  const cup = (cupons.results[0] || {}) as { gerados: number; usados: number; vendas: number }
  return {
    de,
    ate,
    resumo: {
      exibicoes: soma('total'),
      qr: soma('qr'),
      ...metricas({ exibicoes: soma('total'), impactos: soma('impactos'), alcance: soma('alcance') }, investimento),
    },
    // prova de venda: cupons únicos gerados pelo QR e validados pela loja
    cupons: cp.cupom_oferta
      ? {
          oferta: cp.cupom_oferta,
          gerados: Number(cup.gerados) || 0,
          usados: Number(cup.usados) || 0,
          vendas: Number(cup.vendas) || 0,
          conversao: cup.gerados ? Math.round((cup.usados / cup.gerados) * 1000) / 10 : 0,
          retorno: investimento && cup.vendas ? Math.round((cup.vendas / investimento) * 10) / 10 : null,
        }
      : null,
    por_dia: dias,
    por_hora: porHora,
    por_tela: telas,
    por_bairro: [...bairros.values()].sort((a, b) => b.impactos - a.impactos),
    por_peca: porPeca,
    metodologia: padroes,
  }
}
