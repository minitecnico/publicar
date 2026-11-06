<template>
  <section>
    <div v-if="titulo" class="cabecalho-pagina">
      <div>
        <h1>{{ titulo }}</h1>
        <p v-if="subtitulo">{{ subtitulo }}</p>
      </div>
      <div class="barra-ferramentas nao-imprimir">
        <slot name="ferramentas" />
        <button class="btn primario" @click="novo"><Icone nome="mais" /> {{ rotuloNovo }}</button>
      </div>
    </div>

    <div class="cartao">
      <div class="filtros nao-imprimir">
        <div class="busca">
          <Icone nome="busca" :tamanho="16" />
          <input v-model="busca" type="text" :placeholder="`Buscar em ${titulo?.toLowerCase() || 'registros'}…`" />
        </div>
        <select v-if="campoStatus" v-model="filtroStatus" class="filtro-status">
          <option value="">Todos os status</option>
          <option v-for="o in campoStatus.opcoes" :key="o.valor" :value="o.valor">{{ o.rotulo }}</option>
        </select>
        <span class="mudo pequeno">{{ filtradas.length }} de {{ linhas.length }}</span>
        <button v-if="!titulo" class="btn primario pequeno" @click="novo"><Icone nome="mais" /> {{ rotuloNovo }}</button>
      </div>
      <div class="tabela-wrap">
        <table v-if="filtradas.length" class="tabela">
          <thead>
            <tr>
              <th v-for="c in colunas" :key="c.key" :class="{ num: c.tipo === 'dinheiro' || c.tipo === 'numero' }">{{ c.label }}</th>
              <th class="acoes nao-imprimir"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in filtradas" :key="l.id">
              <td v-for="c in colunas" :key="c.key" :class="{ num: c.tipo === 'dinheiro' || c.tipo === 'numero' }">
                <slot :name="`celula-${c.key}`" :linha="l" :valor="l[c.key]">
                  <span v-if="c.selo" class="selo" :class="c.selo(l[c.key])">{{ textoCelula(c, l) }}</span>
                  <template v-else>{{ textoCelula(c, l) }}</template>
                </slot>
              </td>
              <td class="acoes nao-imprimir">
                <slot name="acoes" :linha="l" />
                <button class="btn fantasma pequeno" @click="editar(l)">Editar</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="vazio">
          <strong>{{ carregando ? 'Carregando…' : linhas.length ? 'Nada encontrado com esse filtro' : 'Nenhum registro ainda' }}</strong>
          <span v-if="!carregando && !linhas.length">Clique em “{{ rotuloNovo }}” para começar.</span>
        </div>
      </div>
    </div>

    <Modal :aberto="modalAberto" :titulo="form.id ? `Editar: ${form.nome || form.descricao || '#' + form.id}` : rotuloNovo" larga @fechar="modalAberto = false">
      <form id="form-crud" class="grade-form" @submit.prevent="salvar">
        <template v-for="c in campos" :key="c.key">
          <label v-if="!c.mostrarSe || c.mostrarSe(form)" class="campo" :class="{ inteira: c.inteira || ['textarea', 'midia', 'conteudo', 'telas', 'checks'].includes(c.tipo || '') }">
            <span>{{ c.label }}<span v-if="c.obrigatorio" class="obrig"> *</span></span>
            <select v-if="c.tipo === 'select'" v-model="form[c.key]" :required="c.obrigatorio">
              <option v-for="o in c.opcoes" :key="o.valor" :value="o.valor">{{ o.rotulo }}</option>
            </select>
            <select v-else-if="c.tipo === 'relacao'" v-model="form[c.key]" :required="c.obrigatorio">
              <option :value="null">— nenhum —</option>
              <option v-for="r in opcoesRelacao(c)" :key="r.id" :value="r.id">{{ r.nome }}</option>
            </select>
            <textarea v-else-if="c.tipo === 'textarea'" v-model="form[c.key]" rows="3" />
            <input v-else-if="c.tipo === 'numero' || c.tipo === 'dinheiro'" v-model.number="form[c.key]" type="number" :step="c.tipo === 'dinheiro' ? '0.01' : '1'" :required="c.obrigatorio" />
            <input v-else-if="c.tipo === 'data'" v-model="form[c.key]" type="date" :required="c.obrigatorio" />
            <div v-else-if="c.tipo === 'cor'" class="linha"><input v-model="form[c.key]" type="color" class="cor" /><input v-model="form[c.key]" type="text" /></div>
            <MediaInput v-else-if="c.tipo === 'midia'" v-model="form[c.key]" :tipo="form.midia_tipo" @tipo-detectado="(t) => (form.midia_tipo = t)" />
            <ConteudoEditor v-else-if="c.tipo === 'conteudo'" v-model="form[c.key]" />
            <div v-else-if="c.tipo === 'telas'" class="checks">
              <label class="check"><input type="checkbox" :checked="!form[c.key]?.length" @change="form[c.key] = []" /> Todas as telas do tipo escolhido</label>
              <label v-for="t in relacoes.telas || []" :key="t.id" class="check">
                <input type="checkbox" :value="t.id" :checked="form[c.key]?.includes(t.id)" @change="alternar(c.key, t.id)" /> {{ t.nome }} <span class="mudo pequeno">({{ t.tipo }}{{ t.bairro ? ' · ' + t.bairro : '' }})</span>
              </label>
            </div>
            <div v-else-if="c.tipo === 'checks'" class="checks linha-checks">
              <label v-for="o in c.opcoes" :key="o.valor" class="check">
                <input type="checkbox" :checked="form[c.key]?.includes(o.valor)" @change="alternar(c.key, o.valor)" /> {{ o.rotulo }}
              </label>
            </div>
            <input v-else :type="c.tipo === 'email' ? 'email' : c.tipo === 'telefone' ? 'tel' : 'text'" v-model="form[c.key]" :required="c.obrigatorio" />
            <span v-if="c.dica" class="dica">{{ c.dica }}</span>
          </label>
        </template>
      </form>
      <template #rodape>
        <button v-if="form.id" type="button" class="btn perigo" style="margin-right: auto" @click="excluir">Excluir</button>
        <button type="button" class="btn" @click="modalAberto = false">Cancelar</button>
        <button type="submit" form="form-crud" class="btn primario" :disabled="salvando">{{ salvando ? 'Salvando…' : 'Salvar' }}</button>
      </template>
    </Modal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import type { Campo } from '../campos'
import { data, moeda, numero } from '../format'
import { avisar, erro } from '../toast'
import ConteudoEditor from './ConteudoEditor.vue'
import Icone from './Icone.vue'
import MediaInput from './MediaInput.vue'
import Modal from './Modal.vue'

const props = withDefaults(
  defineProps<{
    recurso: string
    titulo?: string
    subtitulo?: string
    campos: Campo[]
    padrao?: Record<string, any>
    rotuloNovo?: string
    filtro?: (l: Record<string, any>) => boolean
  }>(),
  { rotuloNovo: 'Novo', padrao: () => ({}) },
)
const emit = defineEmits<{ alterado: [] }>()

const linhas = ref<Record<string, any>[]>([])
const relacoes = reactive<Record<string, Record<string, any>[]>>({})
const carregando = ref(true)
const busca = ref('')
const filtroStatus = ref('')
const modalAberto = ref(false)
const salvando = ref(false)
const form = reactive<Record<string, any>>({})

const colunas = computed(() => props.campos.filter((c) => c.lista))
const campoStatus = computed(() => props.campos.find((c) => c.key === 'status' && c.opcoes))
const mapaRel = computed(() => {
  const m: Record<string, Record<number, Record<string, any>>> = {}
  for (const [k, lista] of Object.entries(relacoes)) m[k] = Object.fromEntries(lista.map((r) => [r.id, r]))
  return m
})

const filtradas = computed(() => {
  const q = busca.value.trim().toLowerCase()
  return linhas.value.filter((l) => {
    if (props.filtro && !props.filtro(l)) return false
    if (filtroStatus.value && l.status !== filtroStatus.value) return false
    if (!q) return true
    return Object.values(l).some((v) => typeof v === 'string' && v.toLowerCase().includes(q))
  })
})

function textoCelula(c: Campo, l: Record<string, any>): string {
  const v = l[c.key]
  if (c.celula) return c.celula(v, l, mapaRel.value)
  if (c.tipo === 'relacao' && c.relacao) return mapaRel.value[c.relacao]?.[v]?.nome ?? '—'
  if (c.tipo === 'dinheiro') return moeda(v)
  if (c.tipo === 'numero') return numero(v)
  if (c.tipo === 'data') return data(v)
  if (c.tipo === 'select') return c.opcoes?.find((o) => o.valor === v)?.rotulo ?? v ?? '—'
  return v == null || v === '' ? '—' : String(v)
}

function opcoesRelacao(c: Campo) {
  const lista = relacoes[c.relacao!] || []
  return c.filtroRelacao ? lista.filter(c.filtroRelacao) : lista
}

function alternar(key: string, valor: any) {
  const atual: any[] = Array.isArray(form[key]) ? [...form[key]] : []
  const i = atual.indexOf(valor)
  if (i >= 0) atual.splice(i, 1)
  else atual.push(valor)
  form[key] = atual
}

async function carregar() {
  carregando.value = true
  try {
    const rels = new Set(props.campos.filter((c) => c.relacao).map((c) => c.relacao!))
    if (props.campos.some((c) => c.tipo === 'telas')) rels.add('telas')
    const [dados, ...outras] = await Promise.all([api.get(`/${props.recurso}`), ...[...rels].map((r) => api.get(`/${r}`))])
    ;[...rels].forEach((r, i) => (relacoes[r] = outras[i]))
    linhas.value = dados
  } catch (e) {
    erro(e)
  } finally {
    carregando.value = false
  }
}

function preencher(dados: Record<string, any>) {
  for (const k of Object.keys(form)) delete form[k]
  Object.assign(form, JSON.parse(JSON.stringify(dados)))
}

function novo(extra: Record<string, any> = {}) {
  const base: Record<string, any> = {}
  for (const c of props.campos) {
    base[c.key] = ['telas', 'conteudo', 'checks'].includes(c.tipo || '') ? [] : c.tipo === 'relacao' ? null : c.tipo === 'select' ? c.opcoes?.[0]?.valor : ''
  }
  preencher({ ...base, ...props.padrao, ...(extra instanceof Event ? {} : extra) })
  modalAberto.value = true
}

function editar(l: Record<string, any>) {
  preencher(l)
  modalAberto.value = true
}

async function salvar() {
  salvando.value = true
  try {
    const corpo: Record<string, any> = {}
    for (const c of props.campos) corpo[c.key] = form[c.key]
    if (form.id) await api.put(`/${props.recurso}/${form.id}`, corpo)
    else await api.post(`/${props.recurso}`, corpo)
    avisar('Salvo com sucesso')
    modalAberto.value = false
    await carregar()
    emit('alterado')
  } catch (e) {
    erro(e)
  } finally {
    salvando.value = false
  }
}

async function excluir() {
  if (!confirm('Excluir este registro? Esta ação não pode ser desfeita.')) return
  try {
    await api.del(`/${props.recurso}/${form.id}`)
    avisar('Excluído')
    modalAberto.value = false
    await carregar()
    emit('alterado')
  } catch (e) {
    erro(e)
  }
}

async function atualizar(id: number, dados: Record<string, any>) {
  await api.put(`/${props.recurso}/${id}`, dados)
  await carregar()
  emit('alterado')
}

onMounted(carregar)
defineExpose({ carregar, novo, editar, atualizar, linhas, relacoes })
</script>

<style scoped>
.filtros { display: flex; gap: 10px; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--borda); flex-wrap: wrap; }
.busca { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px; border: 1px solid var(--borda); border-radius: 8px; padding: 0 10px; color: var(--texto-2); }
.busca input { border: none; padding: 8px 0; outline: none; }
.filtro-status { width: auto; }
.obrig { color: var(--vermelho); }
.cor { width: 46px; padding: 2px; height: 38px; flex-shrink: 0; }
.checks { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--borda); border-radius: 8px; padding: 10px 12px; max-height: 200px; overflow-y: auto; font-weight: 400; color: var(--texto); }
.linha-checks { flex-direction: row; flex-wrap: wrap; gap: 8px 18px; max-height: none; }
.check { display: flex; align-items: center; gap: 8px; }
.check input { width: auto; }
</style>
