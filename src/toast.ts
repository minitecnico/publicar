import { reactive } from 'vue'

export const toasts = reactive<{ id: number; texto: string; tipo: 'ok' | 'erro' }[]>([])
let seq = 0

export function avisar(texto: string, tipo: 'ok' | 'erro' = 'ok') {
  const id = ++seq
  toasts.push({ id, texto, tipo })
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id)
    if (i >= 0) toasts.splice(i, 1)
  }, tipo === 'erro' ? 6000 : 3000)
}

export const erro = (e: unknown) => avisar(e instanceof Error ? e.message : String(e), 'erro')
