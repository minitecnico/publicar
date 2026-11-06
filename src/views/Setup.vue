<template>
  <div class="tela-acesso">
    <form class="cartao caixa" @submit.prevent="enviar">
      <img src="/logo.png" alt="Publicar — o seu outdoor itinerante" class="logo" />
      <h1>Primeiro acesso</h1>
      <p class="mudo pequeno" style="margin: -6px 0 0; text-align: center">
        Crie a conta de administrador. Este passo só aparece uma vez.
      </p>
      <label class="campo">Nome da empresa <input v-model="f.empresa" type="text" required /></label>
      <label class="campo">Seu nome <input v-model="f.nome" type="text" required /></label>
      <label class="campo">E-mail <input v-model="f.email" type="email" autocomplete="username" required /></label>
      <label class="campo">Senha <span class="dica">mínimo 8 caracteres</span>
        <input v-model="f.senha" type="password" minlength="8" autocomplete="new-password" required />
      </label>
      <p v-if="falha" class="falha">{{ falha }}</p>
      <button class="btn primario" :disabled="carregando">{{ carregando ? 'Criando…' : 'Criar conta e entrar' }}</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { entrar } from '../auth'

const router = useRouter()
const f = reactive({ empresa: 'Publicar', nome: '', email: '', senha: '' })
const falha = ref('')
const carregando = ref(false)

async function enviar() {
  falha.value = ''
  carregando.value = true
  try {
    const r = await api.post('/auth/setup', f)
    entrar(r.token, r.usuario)
    router.push('/')
  } catch (e) {
    falha.value = e instanceof Error ? e.message : 'Falha'
    if (falha.value.includes('já configurado')) router.push('/login')
  } finally {
    carregando.value = false
  }
}
</script>
