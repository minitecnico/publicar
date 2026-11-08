/**
 * Inventário (share of voice) e segmentação por dia/horário.
 *
 * Modelo: cada tela tem um "ciclo de anúncios" de N segundos (padrão 120 s, configurável por empresa).
 * Uma campanha ocupa `duração × inserções` segundos desse ciclo em cada tela e em cada hora em que roda.
 * A ocupação é medida em 7 × 24 posições (dia da semana × hora). Passou de 100% em alguma posição = vendido demais.
 */

export interface Janela { ini: string; fim: string }

export interface CampanhaGrade {
  id: number
  nome: string
  duracao: number
  prioridade: number
  tipo_tela: string
  telas_alvo: number[]
  dias_semana: number[]
  horarios: Janela[]
  inicio: string | null
  fim: string | null
  status: string
}

export interface TelaGrade { id: number; nome: string; tipo: string; bairro: string | null }

export const CICLO_PADRAO = 120
export const MAX_INSERCOES = 5
/** Status que ocupam espaço no inventário (vendido, mesmo que pausado ou aguardando aprovação). */
export const STATUS_RESERVAM = ['ativa', 'pausada', 'aguardando']
export const NOMES_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function lista<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[]
  if (typeof v === 'string' && v) {
    try {
      const x = JSON.parse(v)
      return Array.isArray(x) ? x : []
    } catch { /* inválido = vazio */ }
  }
  return []
}

export function minutos(h: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || '').trim())
  return m ? Math.min(1440, Number(m[1]) * 60 + Number(m[2])) : NaN
}

export function normalizar(row: Record<string, unknown>): CampanhaGrade {
  return {
    id: Number(row.id) || 0,
    nome: String(row.nome ?? ''),
    duracao: Number(row.duracao) || 15,
    prioridade: Number(row.prioridade) || 1,
    tipo_tela: String(row.tipo_tela || 'todas'),
    telas_alvo: lista<number>(row.telas_alvo).map(Number),
    dias_semana: lista<number>(row.dias_semana).map(Number).filter((d) => d >= 0 && d <= 6),
    horarios: lista<Janela>(row.horarios).filter((j) => !isNaN(minutos(j?.ini)) && !isNaN(minutos(j?.fim))),
    inicio: (row.inicio as string) || null,
    fim: (row.fim as string) || null,
    status: String(row.status || ''),
  }
}

export const insercoes = (c: Pick<CampanhaGrade, 'prioridade'>) => Math.max(1, Math.min(MAX_INSERCOES, Math.round(c.prioridade || 1)))
/** Segundos que a campanha ocupa em cada ciclo. */
export const segundosNoCiclo = (c: Pick<CampanhaGrade, 'duracao' | 'prioridade'>) => Math.max(5, c.duracao || 15) * insercoes(c)

/** A janela [ini, fim) cobre algum minuto do intervalo [a, b)? Janela com fim ≤ ini cruza a meia-noite. */
function janelaCobre(j: Janela, a: number, b: number) {
  const i = minutos(j.ini)
  const f = minutos(j.fim)
  if (f > i) return i < b && f > a
  if (f === i) return true
  return b > i || a < f
}

/** A campanha roda em algum momento da hora `h` do dia da semana `dow` (0 = domingo)? */
export function rodaNaHora(c: CampanhaGrade, dow: number, h: number) {
  if (c.dias_semana.length && !c.dias_semana.includes(dow)) return false
  if (!c.horarios.length) return true
  return c.horarios.some((j) => janelaCobre(j, h * 60, h * 60 + 60))
}

export function rodaNaTela(c: CampanhaGrade, t: TelaGrade) {
  if (c.tipo_tela !== 'todas' && c.tipo_tela !== t.tipo) return false
  return !c.telas_alvo.length || c.telas_alvo.includes(t.id)
}

export function periodosSobrepoem(a: CampanhaGrade, b: CampanhaGrade) {
  return (a.inicio || '0000') <= (b.fim || '9999') && (b.inicio || '0000') <= (a.fim || '9999')
}

/** Máscara das 168 posições (dia × hora) em que a campanha roda. */
export function mascara(c: CampanhaGrade): boolean[] {
  const m: boolean[] = []
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) m.push(rodaNaHora(c, d, h))
  return m
}

/** Segundos ocupados por tela em cada uma das 168 posições. */
export function ocupacao(telas: TelaGrade[], campanhas: CampanhaGrade[]): Map<number, number[]> {
  const mascaras = campanhas.map((c) => ({ c, m: mascara(c), s: segundosNoCiclo(c) }))
  const out = new Map<number, number[]>()
  for (const t of telas) {
    const v = new Array<number>(168).fill(0)
    for (const { c, m, s } of mascaras) {
      if (!rodaNaTela(c, t)) continue
      for (let i = 0; i < 168; i++) if (m[i]) v[i] += s
    }
    out.set(t.id, v)
  }
  return out
}

export interface Conflito { tela: string; dia: string; hora: number; usado: number; livre: number }

/** Telas/horários em que a campanha não cabe no ciclo (pior posição de cada tela). */
export function conflitos(nova: CampanhaGrade, outras: CampanhaGrade[], telas: TelaGrade[], ciclo: number): Conflito[] {
  const seg = segundosNoCiclo(nova)
  const alvo = telas.filter((t) => rodaNaTela(nova, t))
  const concorrentes = outras.filter((o) => o.id !== nova.id && STATUS_RESERVAM.includes(o.status) && periodosSobrepoem(o, nova))
  const mNova = mascara(nova)
  const ocup = ocupacao(alvo, concorrentes)
  const res: Conflito[] = []
  for (const t of alvo) {
    const v = ocup.get(t.id)!
    let pior = -1
    for (let i = 0; i < 168; i++) if (mNova[i] && v[i] + seg > ciclo && (pior < 0 || v[i] > v[pior])) pior = i
    if (pior >= 0) res.push({ tela: t.nome, dia: NOMES_DIAS[Math.floor(pior / 24)], hora: pior % 24, usado: v[pior], livre: Math.max(0, ciclo - v[pior]) })
  }
  return res
}

/* ------------------------------------------------------------------ acesso ao banco */

/**
 * Ciclo da tela (segundos) e quanto dele é comercial.
 * conteudo_pct = parte mínima do ciclo reservada a conteúdo (ex.: 60 → só 40% do ciclo é vendável).
 */
export async function configCiclo(db: D1Database, tid: string) {
  const t = await db.prepare('SELECT config FROM tenants WHERE id = ?').bind(tid).first<{ config: string }>()
  let cfg: Record<string, unknown> = {}
  try { cfg = JSON.parse(t?.config || '{}') } catch { /* padrão */ }
  const n = Number(cfg.ciclo_segundos)
  const ciclo = n >= 30 && n <= 3600 ? Math.round(n) : CICLO_PADRAO
  const p = Number(cfg.conteudo_pct)
  const pct = p >= 0 && p <= 80 ? Math.round(p) : 0
  return { ciclo, pct, capacidade: Math.max(5, Math.round((ciclo * (100 - pct)) / 100)), cfg }
}

/** Segundos vendáveis do ciclo (o que o inventário controla). */
export async function cicloDoTenant(db: D1Database, tid: string): Promise<number> {
  return (await configCiclo(db, tid)).capacidade
}

export async function carregarGrade(db: D1Database, tid: string) {
  const [telas, camps] = await db.batch([
    db.prepare("SELECT id, nome, tipo, bairro FROM telas WHERE tenant_id = ? AND status = 'ativa' ORDER BY nome").bind(tid),
    db.prepare(
      `SELECT id, nome, duracao, prioridade, tipo_tela, telas_alvo, dias_semana, horarios, inicio, fim, status
         FROM campanhas WHERE tenant_id = ? AND status IN ('ativa', 'pausada', 'aguardando')`,
    ).bind(tid),
  ])
  return {
    telas: telas.results as unknown as TelaGrade[],
    campanhas: (camps.results as Record<string, unknown>[]).map(normalizar),
  }
}

/** O que define o espaço ocupado: se nada disso mudou, a edição não aumenta a ocupação. */
const assinatura = (c: CampanhaGrade) =>
  JSON.stringify([STATUS_RESERVAM.includes(c.status), segundosNoCiclo(c), c.tipo_tela, c.telas_alvo, c.dias_semana, c.horarios, c.inicio, c.fim])

/**
 * Verifica se a campanha cabe no inventário.
 * `soSeAumentar`: na gravação, só barra edições que aumentam a ocupação (pausar/encerrar nunca é bloqueado,
 * mesmo que o inventário já esteja estourado por outro motivo, como um ciclo reduzido).
 */
export async function verificarCampanha(db: D1Database, tid: string, dados: Record<string, unknown>, id?: number, soSeAumentar = false) {
  let row = dados
  let anterior: CampanhaGrade | null = null
  if (id) {
    const atual = await db.prepare('SELECT * FROM campanhas WHERE id = ? AND tenant_id = ?').bind(id, tid).first<Record<string, unknown>>()
    if (!atual) return { ciclo: CICLO_PADRAO, segundos: 0, conflitos: [] as Conflito[] }
    anterior = normalizar(atual)
    row = { ...atual, ...dados, id }
  }
  const nova = normalizar(row)
  const ciclo = await cicloDoTenant(db, tid)
  const resumo = { ciclo, segundos: segundosNoCiclo(nova), conflitos: [] as Conflito[] }
  // rascunho, encerrada ou já vencida não ocupam espaço
  const hojeStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  if (!STATUS_RESERVAM.includes(nova.status) || (nova.fim && nova.fim < hojeStr)) return resumo
  if (soSeAumentar && anterior && assinatura(anterior) === assinatura(nova)) return resumo
  const { telas, campanhas } = await carregarGrade(db, tid)
  resumo.conflitos = conflitos(nova, campanhas, telas, ciclo)
  return resumo
}

export function mensagemConflito(r: { ciclo: number; segundos: number; conflitos: Conflito[] }) {
  if (!r.conflitos.length) return null
  const exemplos = r.conflitos
    .slice(0, 3)
    .map((c) => `${c.tela} (${c.dia} ${String(c.hora).padStart(2, '0')}h: ${c.livre}s livres)`)
    .join(', ')
  const mais = r.conflitos.length > 3 ? ` e mais ${r.conflitos.length - 3} tela(s)` : ''
  return `Sem espaço no ciclo de ${r.ciclo}s: a campanha precisa de ${r.segundos}s por ciclo. Lotado em ${exemplos}${mais}. Reduza duração/inserções, mude o horário ou tire essas telas.`
}
