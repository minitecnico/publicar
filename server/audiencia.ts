/**
 * Audiência estimada (metodologia de DOOH, transparente para agências).
 *
 *  pessoas/dia        carro: corridas × passageiros  |  estabelecimento: fluxo informado
 *  público no momento = pessoas/dia ÷ horas de operação × permanência   (lei de Little)
 *  impactos/exibição  = público no momento × fator de visibilidade
 *  impactos           = Σ exibições × impactos/exibição                 (impressões)
 *  alcance            = Σ pessoas/dia × P(viu ao menos 1 vez)          P = min(1, permanência × exibições/dia ÷ operação)
 *  frequência         = impactos ÷ alcance
 *  CPM                = investimento no período ÷ impactos × 1000
 */

export interface PadroesAudiencia {
  carro: { corridas: number; passageiros: number; permanencia: number; horas: number; visibilidade: number }
  estabelecimento: { fluxo: number; permanencia: number; horas: number; visibilidade: number }
}

export const PADRAO_AUDIENCIA: PadroesAudiencia = {
  carro: { corridas: 15, passageiros: 1.4, permanencia: 20, horas: 10, visibilidade: 0.9 },
  estabelecimento: { fluxo: 120, permanencia: 15, horas: 10, visibilidade: 0.5 },
}

const num = (v: unknown, padrao: number, min: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : padrao
}

export function normalizarPadroes(cfg: unknown): PadroesAudiencia {
  const c = (cfg || {}) as Partial<Record<'carro' | 'estabelecimento', Record<string, unknown>>>
  const P = PADRAO_AUDIENCIA
  return {
    carro: {
      corridas: num(c.carro?.corridas, P.carro.corridas, 0, 200),
      passageiros: num(c.carro?.passageiros, P.carro.passageiros, 0, 8),
      permanencia: num(c.carro?.permanencia, P.carro.permanencia, 1, 240),
      horas: num(c.carro?.horas, P.carro.horas, 1, 24),
      visibilidade: num(c.carro?.visibilidade, P.carro.visibilidade, 0.05, 1),
    },
    estabelecimento: {
      fluxo: num(c.estabelecimento?.fluxo, P.estabelecimento.fluxo, 0, 100000),
      permanencia: num(c.estabelecimento?.permanencia, P.estabelecimento.permanencia, 1, 600),
      horas: num(c.estabelecimento?.horas, P.estabelecimento.horas, 1, 24),
      visibilidade: num(c.estabelecimento?.visibilidade, P.estabelecimento.visibilidade, 0.05, 1),
    },
  }
}

export async function padroesAudiencia(db: D1Database, tid: string): Promise<PadroesAudiencia> {
  const t = await db.prepare('SELECT config FROM tenants WHERE id = ?').bind(tid).first<{ config: string }>()
  let cfg: Record<string, unknown> = {}
  try { cfg = JSON.parse(t?.config || '{}') } catch { /* padrão */ }
  return normalizarPadroes(cfg.audiencia)
}

/**
 * CTE "aud" com a audiência de cada tela do tenant:
 *   id, pessoas (por dia), perm_s, op_s, vis, imp (impactos por exibição)
 * Use: `${cte.sql} SELECT ... JOIN aud a ON a.id = e.tela_id` e passe `...cte.binds` primeiro.
 */
export function cteAudiencia(p: PadroesAudiencia, tid: string) {
  const sql = `WITH base AS (
      SELECT id,
        CASE WHEN tipo = 'carro' THEN COALESCE(corridas_dia, ?) * COALESCE(passageiros_corrida, ?) ELSE COALESCE(fluxo_dia, ?) END AS pessoas,
        COALESCE(permanencia_min, CASE WHEN tipo = 'carro' THEN ? ELSE ? END) * 60.0 AS perm_s,
        COALESCE(horas_operacao, CASE WHEN tipo = 'carro' THEN ? ELSE ? END) * 3600.0 AS op_s,
        CASE WHEN tipo = 'carro' THEN ? ELSE ? END AS vis
      FROM telas WHERE tenant_id = ?
    ),
    aud AS (SELECT id, pessoas, perm_s, op_s, vis, pessoas * perm_s / op_s * vis AS imp FROM base)`
  const binds = [
    p.carro.corridas, p.carro.passageiros, p.estabelecimento.fluxo,
    p.carro.permanencia, p.estabelecimento.permanencia,
    p.carro.horas, p.estabelecimento.horas,
    p.carro.visibilidade, p.estabelecimento.visibilidade,
    tid,
  ]
  return { sql, binds }
}

/** Expressões SQL (sobre exibicoes e, aud a) para somar impactos e alcance. */
export const SQL_IMPACTOS = 'COALESCE(SUM(e.total * a.imp), 0)'
export const SQL_ALCANCE = 'COALESCE(SUM(a.pessoas * MIN(1.0, a.perm_s * e.total / a.op_s) * a.vis), 0)'

const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000) + 1

/**
 * Parte do valor da campanha que corresponde ao período do relatório.
 * Com início e fim: valor do contrato rateado pelos dias. Sem as duas datas: valor tratado como mensal.
 */
export function investimentoNoPeriodo(valor: unknown, inicio: string | null, fim: string | null, de: string, ate: string): number | null {
  const v = Number(valor)
  if (!v || v <= 0) return null
  const ini = inicio && inicio > de ? inicio : de
  const f = fim && fim < ate ? fim : ate
  const dias = Math.max(0, diasEntre(ini, f))
  if (inicio && fim) return (v * dias) / Math.max(1, diasEntre(inicio, fim))
  return (v * dias) / 30
}

export function metricas(r: { exibicoes: number; impactos: number; alcance: number }, investimento: number | null) {
  const impactos = Math.round(Number(r.impactos) || 0)
  const alcance = Math.round(Number(r.alcance) || 0)
  return {
    impactos,
    alcance,
    frequencia: alcance ? Math.round((impactos / alcance) * 10) / 10 : 0,
    investimento: investimento == null ? null : Math.round(investimento * 100) / 100,
    cpm: investimento != null && impactos ? Math.round((investimento / impactos) * 1000 * 100) / 100 : null,
  }
}
