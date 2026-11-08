const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numFmt = new Intl.NumberFormat('pt-BR')

export const moeda = (v: unknown) => moedaFmt.format(Number(v) || 0)
export const numero = (v: unknown) => numFmt.format(Number(v) || 0)

/** "2026-11-10" → "10/11/2026" */
export function data(v: unknown): string {
  if (!v || typeof v !== 'string') return '—'
  const [a, m, d] = v.slice(0, 10).split('-')
  return d ? `${d}/${m}/${a}` : v
}

export function hoje(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

export function mesAtual(): string {
  return hoje().slice(0, 7)
}

export function diasAtras(n: number): string {
  return new Date(Date.now() - n * 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

/** Tela online = deu sinal nos últimos 10 minutos (ultimo_ping vem em UTC do D1). */
export function online(ultimoPing: unknown): boolean {
  if (!ultimoPing || typeof ultimoPing !== 'string') return false
  return Date.now() - new Date(ultimoPing.replace(' ', 'T') + 'Z').getTime() < 10 * 60 * 1000
}

export function tempoDesde(ultimoPing: unknown): string {
  if (!ultimoPing || typeof ultimoPing !== 'string') return 'nunca conectou'
  const min = Math.round((Date.now() - new Date(ultimoPing.replace(' ', 'T') + 'Z').getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  if (min < 1440) return `há ${Math.round(min / 60)} h`
  return `há ${Math.round(min / 1440)} dias`
}

export function soDigitos(v: unknown) {
  return String(v || '').replace(/\D/g, '')
}

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** "Seg–Sex · 06:00–11:00, 18:00–23:00" a partir de dias_semana e horarios da campanha. */
export function resumoVeiculacao(c: { dias_semana?: unknown; horarios?: unknown }): string {
  const dias = (Array.isArray(c.dias_semana) ? c.dias_semana : []).map(Number).filter((d) => d >= 0 && d <= 6)
  const ordem = [1, 2, 3, 4, 5, 6, 0].filter((d) => dias.includes(d))
  let txtDias = 'Todo dia'
  if (dias.length && dias.length < 7) {
    const seguidos = ordem.every((d, i) => i === 0 || [1, 2, 3, 4, 5, 6, 0].indexOf(d) === [1, 2, 3, 4, 5, 6, 0].indexOf(ordem[i - 1]) + 1)
    txtDias = seguidos && ordem.length > 2 ? `${DIAS_CURTOS[ordem[0]]}–${DIAS_CURTOS[ordem[ordem.length - 1]]}` : ordem.map((d) => DIAS_CURTOS[d]).join(', ')
  }
  const hs = (Array.isArray(c.horarios) ? c.horarios : []) as { ini: string; fim: string }[]
  return `${txtDias} · ${hs.length ? hs.map((h) => `${h.ini}–${h.fim}`).join(', ') : 'dia todo'}`
}
