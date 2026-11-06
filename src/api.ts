import { sessao, sair } from './auth'

export class ErroApi extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem)
  }
}

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (sessao.token) headers.Authorization = `Bearer ${sessao.token}`
  let body: BodyInit | undefined
  if (corpo instanceof FormData) body = corpo
  else if (corpo !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(corpo)
  }
  const res = await fetch(`/api${caminho}`, { method: metodo, headers, body })
  const dados = await res.json().catch(() => ({}))
  if (res.status === 401 && sessao.token) {
    sair()
    location.href = '/login'
  }
  if (!res.ok) throw new ErroApi(res.status, dados.erro || `Erro ${res.status}`)
  return dados as T
}

export const api = {
  get: <T = any>(c: string) => chamar<T>('GET', c),
  post: <T = any>(c: string, d?: unknown) => chamar<T>('POST', c, d ?? {}),
  put: <T = any>(c: string, d: unknown) => chamar<T>('PUT', c, d),
  del: <T = any>(c: string) => chamar<T>('DELETE', c),
  upload: (arquivo: File) => {
    const f = new FormData()
    f.append('arquivo', arquivo)
    return chamar<{ url: string; tipo: string; tamanho: number }>('POST', '/media', f)
  },
}
