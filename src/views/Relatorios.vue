<template>
  <div>
    <div class="cabecalho-pagina">
      <div>
        <h1>Relatórios</h1>
        <p>Prova de exibição por campanha: quantas vezes rodou, em quantas telas e quantos QR codes foram lidos.</p>
      </div>
      <div class="barra-ferramentas nao-imprimir">
        <label class="linha pequeno">De <input v-model="de" type="date" /></label>
        <label class="linha pequeno">até <input v-model="ate" type="date" /></label>
        <button class="btn" @click="carregar">Atualizar</button>
        <button class="btn" @click="imprimir"><Icone nome="imprimir" /> Imprimir / PDF</button>
      </div>
    </div>

    <div class="cartao tabela-wrap">
      <table v-if="linhas.length" class="tabela">
        <thead>
          <tr><th>Campanha</th><th>Anunciante</th><th>Status</th><th class="num">Exibições</th><th class="num">Telas</th><th class="num">Dias</th><th class="num">QR lidos</th><th class="acoes nao-imprimir"></th></tr>
        </thead>
        <tbody>
          <tr v-for="l in linhas" :key="l.id">
            <td><strong>{{ l.nome }}</strong></td>
            <td>{{ l.cliente || '—' }}</td>
            <td><span class="selo" :class="corStatus(l.status)">{{ l.status }}</span></td>
            <td class="num">{{ numero(l.exibicoes) }}</td>
            <td class="num">{{ l.telas }}</td>
            <td class="num">{{ l.dias }}</td>
            <td class="num">{{ numero(l.qr) }}</td>
            <td class="acoes nao-imprimir"><button class="btn pequeno fantasma" @click="detalhar(l)">Detalhar</button></td>
          </tr>
        </tbody>
        <tfoot>
          <tr><td colspan="3"><strong>Total</strong></td><td class="num"><strong>{{ numero(soma('exibicoes')) }}</strong></td><td></td><td></td><td class="num"><strong>{{ numero(soma('qr')) }}</strong></td><td class="nao-imprimir"></td></tr>
        </tfoot>
      </table>
      <div v-else class="vazio"><strong>Sem campanhas no período</strong>As exibições aparecem aqui assim que as telas começam a tocar.</div>
    </div>

    <Modal :aberto="!!det" :titulo="`Relatório: ${det?.nome}`" larga @fechar="det = null">
      <div v-if="det && detalhe">
        <p class="mudo" style="margin-top: 0">
          {{ data(detalhe.de) }} a {{ data(detalhe.ate) }} · {{ det.cliente || 'sem anunciante' }} ·
          <strong>{{ numero(det.exibicoes) }}</strong> exibições · <strong>{{ numero(det.qr) }}</strong> QR lidos
        </p>
        <div v-if="detalhe.por_peca?.length" class="por-peca">
          <h3>Por peça</h3>
          <table class="tabela">
            <thead><tr><th>Peça</th><th>Status</th><th class="num">Exibições</th><th class="num">Share</th></tr></thead>
            <tbody>
              <tr v-for="p in detalhe.por_peca" :key="p.id">
                <td>
                  <div class="peca-nome">
                    <span class="mini"><img v-if="p.midia_tipo === 'imagem'" :src="p.midia_url" alt="" /><video v-else-if="p.midia_tipo === 'video'" :src="p.midia_url" muted preload="metadata" /><span v-else>YT</span></span>
                    {{ p.nome || 'Peça ' + p.id }}
                  </div>
                </td>
                <td><span class="selo" :class="corStatus(p.status)">{{ p.status }}</span></td>
                <td class="num">{{ numero(p.total) }}</td>
                <td class="num">{{ totalPecas ? Math.round((p.total / totalPecas) * 100) + '%' : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="duas">
          <div>
            <h3>Por dia</h3>
            <table class="tabela">
              <thead><tr><th>Dia</th><th class="num">Exibições</th><th class="num">QR</th></tr></thead>
              <tbody><tr v-for="d in detalhe.por_dia" :key="d.dia"><td>{{ data(d.dia) }}</td><td class="num">{{ numero(d.total) }}</td><td class="num">{{ d.qr }}</td></tr></tbody>
            </table>
          </div>
          <div>
            <h3>Por tela</h3>
            <table class="tabela">
              <thead><tr><th>Tela</th><th class="num">Exibições</th><th class="num">QR</th></tr></thead>
              <tbody><tr v-for="t in detalhe.por_tela" :key="t.nome"><td>{{ t.nome }} <span class="mudo pequeno">{{ t.bairro }}</span></td><td class="num">{{ numero(t.total) }}</td><td class="num">{{ t.qr }}</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'
import Icone from '../components/Icone.vue'
import Modal from '../components/Modal.vue'
import { corStatus } from '../campos'
import { data, diasAtras, hoje, numero } from '../format'
import { erro } from '../toast'

const de = ref(diasAtras(29))
const ate = ref(hoje())
const linhas = ref<any[]>([])
const det = ref<any>(null)
const detalhe = ref<any>(null)
const totalPecas = computed(() => (detalhe.value?.por_peca || []).reduce((s: number, p: any) => s + Number(p.total || 0), 0))
const soma = (k: string) => linhas.value.reduce((s, l) => s + Number(l[k] || 0), 0)

async function carregar() {
  try {
    const r = await api.get(`/relatorios?de=${de.value}&ate=${ate.value}`)
    linhas.value = r.campanhas
  } catch (e) {
    erro(e)
  }
}

async function detalhar(l: any) {
  det.value = l
  detalhe.value = null
  try {
    detalhe.value = await api.get(`/relatorios/campanha/${l.id}?de=${de.value}&ate=${ate.value}`)
  } catch (e) {
    erro(e)
  }
}

const imprimir = () => window.print()
onMounted(carregar)
</script>

<style scoped>
input[type='date'] { width: auto; }
tfoot td { border-top: 2px solid var(--borda); background: #fbfaf8; }
.duas { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.duas h3 { margin-bottom: 6px; }
.por-peca { margin-bottom: 18px; }
.por-peca h3 { margin-bottom: 6px; }
.peca-nome { display: flex; align-items: center; gap: 10px; }
.mini { width: 48px; height: 30px; border-radius: 5px; background: #1e1e1e; overflow: hidden; display: grid; place-items: center; color: #fff; font-size: 0.65rem; flex-shrink: 0; }
.mini img, .mini video { width: 100%; height: 100%; object-fit: cover; }
@media (max-width: 700px) { .duas { grid-template-columns: 1fr; } }
</style>
