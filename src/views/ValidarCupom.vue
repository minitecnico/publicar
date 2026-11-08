<template>
  <div class="validar">
    <div class="caixa cartao">
      <img src="/logo.png" alt="" class="logo" />
      <template v-if="info">
        <span class="anunciante">{{ info.anunciante || info.campanha }}</span>
        <h1>Validar cupom</h1>
        <p class="mudo">{{ info.oferta || 'Cupom da campanha' }}</p>

        <form @submit.prevent="validar">
          <input v-model="codigo" class="codigo" maxlength="6" placeholder="CÓDIGO" autocapitalize="characters" autocomplete="off" required />
          <label class="campo">Valor da venda (opcional)
            <input v-model="valor" type="text" inputmode="decimal" placeholder="R$ 0,00" />
          </label>
          <button class="btn primario grande" :disabled="enviando">{{ enviando ? 'Validando…' : 'Validar cupom' }}</button>
        </form>

        <div v-if="resultado" class="resultado" :class="resultado.ok ? 'ok' : 'falha'">{{ resultado.msg }}</div>

        <div class="numeros">
          <div><strong>{{ info.resumo.gerados }}</strong><span>cupons gerados</span></div>
          <div><strong>{{ info.resumo.usados }}</strong><span>usados na loja</span></div>
          <div><strong>{{ moeda(info.resumo.vendas) }}</strong><span>em vendas</span></div>
        </div>
        <ul v-if="info.ultimos.length" class="ultimos">
          <li v-for="u in info.ultimos" :key="u.codigo"><code>{{ u.codigo }}</code><span>{{ u.valor_venda ? moeda(u.valor_venda) : '—' }}</span></li>
        </ul>
      </template>
      <p v-else class="mudo">{{ falha || 'Carregando…' }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { moeda } from '../format'

/** Página da loja (sem login): valida o cupom que o cliente recebeu ao ler o QR da tela. */
const route = useRoute()
const token = String(route.params.token)
const info = ref<any>(null)
const falha = ref('')
const codigo = ref('')
const valor = ref('')
const enviando = ref(false)
const resultado = ref<{ ok: boolean; msg: string } | null>(null)

async function carregar() {
  try {
    const r = await fetch(`/api/publico/loja/${encodeURIComponent(token)}`, { cache: 'no-store' })
    const corpo = await r.json()
    if (!r.ok) { falha.value = corpo.erro || 'Link indisponível'; return }
    info.value = corpo
    document.title = `Validar cupom · ${corpo.anunciante || corpo.campanha}`
  } catch {
    falha.value = 'Sem conexão. Tente de novo.'
  }
}

async function validar() {
  enviando.value = true
  resultado.value = null
  try {
    const v = Number(valor.value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
    const r = await fetch(`/api/publico/loja/${encodeURIComponent(token)}/validar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: codigo.value, valor: Number.isFinite(v) && v > 0 ? v : undefined }),
    })
    const corpo = await r.json()
    if (r.ok) {
      resultado.value = { ok: true, msg: `✓ Cupom ${codigo.value.toUpperCase()} válido! Aplique: ${corpo.oferta || 'a oferta da campanha'}.` }
      codigo.value = ''
      valor.value = ''
      carregar()
    } else resultado.value = { ok: false, msg: corpo.erro || 'Não foi possível validar' }
  } catch {
    resultado.value = { ok: false, msg: 'Sem conexão. Tente de novo.' }
  } finally {
    enviando.value = false
  }
}

onMounted(carregar)
</script>

<style scoped>
.validar { min-height: 100vh; display: grid; place-items: center; padding: 20px 16px; background: var(--fundo); }
.caixa { width: 100%; max-width: 420px; padding: 26px 22px; text-align: center; display: flex; flex-direction: column; gap: 8px; }
.logo { width: 120px; align-self: center; }
.anunciante { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: var(--texto-2); }
h1 { margin: 0; font-size: 1.5rem; }
form { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; text-align: left; }
.codigo { font: 800 2rem/1 ui-monospace, Menlo, monospace; letter-spacing: 0.3em; text-align: center; text-transform: uppercase; padding: 14px; border: 2px solid var(--borda); border-radius: 12px; }
.codigo:focus { outline: none; border-color: var(--laranja); }
.grande { padding: 14px; font-size: 1.05rem; }
.resultado { border-radius: 10px; padding: 12px; font-weight: 700; }
.resultado.ok { background: var(--verde-claro); color: var(--verde); }
.resultado.falha { background: var(--vermelho-claro); color: var(--vermelho); }
.numeros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
.numeros div { background: #fbfaf8; border: 1px solid var(--borda); border-radius: 10px; padding: 8px 4px; display: flex; flex-direction: column; }
.numeros strong { font-size: 1.1rem; }
.numeros span { font-size: 0.72rem; color: var(--texto-2); }
.ultimos { list-style: none; margin: 6px 0 0; padding: 0; text-align: left; font-size: 0.85rem; }
.ultimos li { display: flex; justify-content: space-between; padding: 5px 2px; border-bottom: 1px solid #efede8; }
</style>
