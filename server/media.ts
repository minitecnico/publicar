import type { Context } from 'hono'
import type { AppEnv } from './types'

const LIMITE_KV = 25 * 1024 * 1024 // 25 MB por valor no KV
const TIPOS_OK = /^(image\/(png|jpe?g|webp|gif|svg\+xml)|video\/(mp4|webm))$/

/** Guarda um arquivo enviado (R2 se houver, senão KV). Usado pelo painel e pelo portal do anunciante. */
export async function guardarArquivo(env: AppEnv['Bindings'], tid: string, arquivo: unknown): Promise<{ url: string; tipo: string; tamanho: number } | { erro: string; status: 400 | 413 | 500 }> {
  if (!(arquivo instanceof File)) return { erro: 'Envie o campo "arquivo"', status: 400 }
  if (!TIPOS_OK.test(arquivo.type)) return { erro: 'Use imagem (PNG, JPG, WEBP, GIF) ou vídeo (MP4, WEBM)', status: 400 }
  const ext = (arquivo.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  const chave = `${tid}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  if (env.MEDIA) {
    await env.MEDIA.put(chave, arquivo.stream(), { httpMetadata: { contentType: arquivo.type } })
  } else if (env.MEDIA_KV) {
    if (arquivo.size > LIMITE_KV) return { erro: 'Arquivo acima de 25 MB. Comprima o vídeo ou ative o R2.', status: 413 }
    await env.MEDIA_KV.put(chave, await arquivo.arrayBuffer(), { metadata: { tipo: arquivo.type, tamanho: arquivo.size } })
  } else {
    return { erro: 'Nenhum armazenamento de mídia configurado', status: 500 }
  }
  return { url: `/api/media/${chave}`, tipo: arquivo.type, tamanho: arquivo.size }
}

export async function enviarMidia(c: Context<AppEnv>) {
  const form = await c.req.parseBody()
  const r = await guardarArquivo(c.env, c.get('sessao').tid, form['arquivo'])
  return 'erro' in r ? c.json({ erro: r.erro }, r.status) : c.json(r, 201)
}

export async function servirMidia(c: Context<AppEnv>) {
  const chave = c.req.path.replace(/^\/api\/media\//, '')
  const cabecalhos: Record<string, string> = {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Access-Control-Allow-Origin': '*',
  }
  if (c.env.MEDIA) {
    const obj = await c.env.MEDIA.get(chave)
    if (obj) {
      return new Response(obj.body, {
        headers: { ...cabecalhos, 'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream' },
      })
    }
  }
  if (c.env.MEDIA_KV) {
    const { value, metadata } = await c.env.MEDIA_KV.getWithMetadata<{ tipo: string }>(chave, { type: 'arrayBuffer', cacheTtl: 86400 })
    if (value) {
      return new Response(value, {
        headers: { ...cabecalhos, 'Content-Type': metadata?.tipo || 'application/octet-stream' },
      })
    }
  }
  return c.json({ erro: 'Mídia não encontrada' }, 404)
}
