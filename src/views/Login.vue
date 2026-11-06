<template>
  <div class="tela-acesso">
    <form class="cartao caixa" @submit.prevent="enviar">
      <img src="/logo.png" alt="Publicar — o seu outdoor itinerante" class="logo" />
      <h1>Entrar no painel</h1>
      <label class="campo">E-mail <input v-model="email" type="email" autocomplete="username" required /></label>
      <label class="campo">Senha <input v-model="senha" type="password" autocomplete="current-password" required /></label>
      <p v-if="falha" class="falha">{{ falha }}</p>
      <button class="btn primario" :disabled="carregando">{{ carregando ? 'Entrando…' : 'Entrar' }}</button>
      <RouterLink to="/tela" class="link-tela">Abrir o player de uma tela →</RouterLink>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { entrar } from '../auth'

const router = useRouter()
const email = ref('')
const senha = ref('')
const falha = ref('')
const carregando = ref(false)

async function enviar() {
  falha.value = ''
  carregando.value = true
  try {
    const r = await api.post('/auth/login', { email: email.value, senha: senha.value })
    entrar(r.token, r.usuario)
    router.push('/')
  } catch (e) {
    falha.value = e instanceof Error ? e.message : 'Falha ao entrar'
  } finally {
    carregando.value = false
  }
}
</script>

<style>
.tela-acesso { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at 20% 10%, #fdf3e6 0, transparent 45%), var(--fundo); }
.tela-acesso .caixa { width: 100%; max-width: 400px; padding: 32px; display: flex; flex-direction: column; gap: 16px; }
.tela-acesso .logo { width: 170px; align-self: center; margin-bottom: 4px; }
.tela-acesso h1 { font-size: 1.25rem; text-align: center; }
.tela-acesso .btn { padding: 11px; margin-top: 4px; }
.tela-acesso .falha { margin: 0; color: var(--vermelho); background: var(--vermelho-claro); padding: 8px 12px; border-radius: 8px; font-size: 0.88rem; }
.tela-acesso .link-tela { text-align: center; font-size: 0.85rem; color: var(--texto-2); }
</style>
