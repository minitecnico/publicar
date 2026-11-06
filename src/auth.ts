import { reactive } from 'vue'

interface Usuario {
  nome: string
  email: string
  papel: 'admin' | 'operador'
}

const salvo = (() => {
  try {
    return JSON.parse(localStorage.getItem('publicar.sessao') || 'null')
  } catch {
    return null
  }
})()

export const sessao = reactive<{ token: string | null; usuario: Usuario | null; modulos: string[] }>({
  token: salvo?.token ?? null,
  usuario: salvo?.usuario ?? null,
  modulos: salvo?.modulos ?? ['mobilidade', 'estabelecimentos', 'financeiro', 'cobranca', 'relatorios'],
})

export function entrar(token: string, usuario: Usuario) {
  sessao.token = token
  sessao.usuario = usuario
  persistir()
}

export function definirModulos(m: string[]) {
  sessao.modulos = m
  persistir()
}

function persistir() {
  localStorage.setItem('publicar.sessao', JSON.stringify({ token: sessao.token, usuario: sessao.usuario, modulos: sessao.modulos }))
}

export function sair() {
  sessao.token = null
  sessao.usuario = null
  localStorage.removeItem('publicar.sessao')
}
