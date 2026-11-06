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
