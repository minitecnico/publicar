import { sign, verify } from 'hono/jwt'
import type { Context, Next } from 'hono'
import type { AppEnv, Env, Sessao } from './types'

// PBKDF2 nativo do Workers. Iterações moderadas para caber no limite de CPU do plano grátis.
const ITERACOES = 20000

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))))
const unb64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0))

async function derivar(senha: string, salt: Uint8Array, iter: number): Promise<ArrayBuffer> {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, chave, 256)
}

export async function hashSenha(senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivar(senha, salt, ITERACOES)
  return `pbkdf2$${ITERACOES}$${b64(salt)}$${b64(hash)}`
}

export async function conferirSenha(senha: string, armazenado: string): Promise<boolean> {
  const [alg, iter, salt, hash] = armazenado.split('$')
  if (alg !== 'pbkdf2') return false
  const calc = b64(await derivar(senha, unb64(salt), Number(iter)))
  // comparação em tempo constante
  if (calc.length !== hash.length) return false
  let diff = 0
  for (let i = 0; i < calc.length; i++) diff |= calc.charCodeAt(i) ^ hash.charCodeAt(i)
  return diff === 0
}

let segredoCache: string | null = null

/** Segredo de sessão: variável APP_SECRET ou um valor aleatório guardado no D1 na primeira execução. */
export async function segredo(env: Env): Promise<string> {
  if (env.APP_SECRET) return env.APP_SECRET
  if (segredoCache) return segredoCache
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").first<{ value: string }>()
  if (row) return (segredoCache = row.value)
  const novo = b64(crypto.getRandomValues(new Uint8Array(32)))
  await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('jwt_secret', ?)").bind(novo).run()
  const final = await env.DB.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").first<{ value: string }>()
  return (segredoCache = final!.value)
}

export async function emitirToken(env: Env, s: Omit<Sessao, 'exp'>): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 dias
  return sign({ ...s, exp }, await segredo(env), 'HS256')
}

export async function exigirLogin(c: Context<AppEnv>, next: Next) {
  const h = c.req.header('Authorization') || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : ''
  if (!token) return c.json({ erro: 'Não autenticado' }, 401)
  try {
    const s = (await verify(token, await segredo(c.env), 'HS256')) as unknown as Sessao
    c.set('sessao', s)
  } catch {
    return c.json({ erro: 'Sessão expirada' }, 401)
  }
  await next()
}

export async function exigirAdmin(c: Context<AppEnv>, next: Next) {
  if (c.get('sessao')?.papel !== 'admin') return c.json({ erro: 'Apenas administradores' }, 403)
  await next()
}
