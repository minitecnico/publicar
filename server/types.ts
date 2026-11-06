export interface Env {
  DB: D1Database
  /** Mídia no KV (padrão, plano grátis sem cartão). */
  MEDIA_KV?: KVNamespace
  /** Mídia no R2 (opcional, exige cartão cadastrado na Cloudflare). */
  MEDIA?: R2Bucket
  /** Segredo para assinar sessões. Se ausente, é gerado e guardado no D1. */
  APP_SECRET?: string
}

export interface Sessao {
  sub: number
  tid: string
  papel: 'admin' | 'operador'
  nome: string
  exp: number
}

export type AppEnv = { Bindings: Env; Variables: { sessao: Sessao } }

export const FUSO = 'America/Sao_Paulo'

/** Data de hoje (AAAA-MM-DD) no fuso de Brasília. */
export function hoje(d = new Date()): string {
  return d.toLocaleDateString('sv-SE', { timeZone: FUSO })
}

/** Mês atual (AAAA-MM) no fuso de Brasília. */
export function mesAtual(): string {
  return hoje().slice(0, 7)
}
