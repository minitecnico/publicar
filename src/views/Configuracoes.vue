<template>
  <div>
    <div class="cabecalho-pagina">
      <div>
        <h1>Configurações</h1>
        <p>Dados da empresa, cobrança, módulos do sistema e usuários.</p>
      </div>
    </div>

    <form class="cartao pad" @submit.prevent="salvar">
      <h2>Empresa e cobrança</h2>
      <div class="grade-form" style="margin-top: 14px">
        <label class="campo">Nome da empresa <input v-model="cfg.nome" type="text" required /></label>
        <label class="campo">CNPJ <input v-model="cfg.config.cnpj" type="text" /></label>
        <label class="campo">Chave Pix para recebimento <input v-model="cfg.config.chave_pix" type="text" /></label>
        <label class="campo">WhatsApp comercial <input v-model="cfg.config.whatsapp" type="tel" /></label>
        <label class="campo">Ciclo de anúncios (segundos)
          <input v-model.number="cfg.config.ciclo_segundos" type="number" min="30" max="3600" step="5" placeholder="120" />
          <span class="dica">Tempo de anúncio que cada tela vende por ciclo. 120s = 8 espaços de 15s, cada um exibido ~30 vezes por hora. A sobra vira entretenimento.</span>
        </label>
        <label class="campo inteira">Mensagem de cobrança
          <textarea v-model="cfg.config.mensagem_cobranca" rows="3" />
          <span class="dica">Variáveis: {cliente} {descricao} {valor} {vencimento} {pix} {empresa}</span>
        </label>
      </div>

      <h2 class="secao">Módulos ativos</h2>
      <p class="mudo pequeno" style="margin: 4px 0 12px">Ligue só o que você usa. O menu se ajusta na hora.</p>
      <div class="modulos">
        <label v-for="m in MODULOS" :key="m.valor" class="modulo cartao" :class="{ ligado: cfg.modulos.includes(m.valor) }">
          <input type="checkbox" :checked="cfg.modulos.includes(m.valor)" @change="alternar(m.valor)" />
          <div><strong>{{ m.rotulo }}</strong><span>{{ m.desc }}</span></div>
        </label>
      </div>
      <div class="linha" style="margin-top: 18px; justify-content: flex-end">
        <button class="btn primario" :disabled="salvando">{{ salvando ? 'Salvando…' : 'Salvar configurações' }}</button>
      </div>
    </form>

    <div class="secao">
      <div class="linha" style="margin-bottom: 12px">
        <h2>Usuários</h2>
        <span class="espaco" />
        <button class="btn pequeno" @click="novoUsuario = true"><Icone nome="mais" :tamanho="14" /> Novo usuário</button>
      </div>
      <div class="cartao tabela-wrap">
        <table class="tabela">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th class="acoes"></th></tr></thead>
          <tbody>
            <tr v-for="u in usuarios" :key="u.id">
              <td><strong>{{ u.nome }}</strong></td>
              <td>{{ u.email }}</td>
              <td><span class="selo" :class="u.papel === 'admin' ? 'laranja' : ''">{{ u.papel === 'admin' ? 'Administrador' : 'Operador' }}</span></td>
              <td class="acoes"><button class="btn pequeno perigo" @click="removerUsuario(u)">Remover</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="secao cartao pad sobre">
      <h2>Sobre a infraestrutura</h2>
      <p class="mudo pequeno">
        Rodando 100% na Cloudflare (plano grátis): Pages para o site, Functions para a API, D1 como banco de dados e KV para as mídias
        (até 25 MB por arquivo). Limites diários do plano grátis: 100 mil requisições, 5 milhões de leituras e 100 mil gravações no banco.
      </p>
    </div>

    <Modal :aberto="novoUsuario" titulo="Novo usuário" @fechar="novoUsuario = false">
      <form id="form-user" class="grade-form" @submit.prevent="criarUsuario">
        <label class="campo">Nome <input v-model="u.nome" type="text" required /></label>
        <label class="campo">E-mail <input v-model="u.email" type="email" required /></label>
        <label class="campo">Senha inicial <input v-model="u.senha" type="password" minlength="8" required /></label>
        <label class="campo">Papel
          <select v-model="u.papel"><option value="operador">Operador</option><option value="admin">Administrador</option></select>
        </label>
      </form>
      <template #rodape>
        <button class="btn" @click="novoUsuario = false">Cancelar</button>
        <button class="btn primario" form="form-user">Criar</button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import { definirModulos, sessao } from '../auth'
import Icone from '../components/Icone.vue'
import Modal from '../components/Modal.vue'
import { avisar, erro } from '../toast'

const MODULOS = [
  { valor: 'mobilidade', rotulo: 'Mobilidade', desc: 'Motoristas e telas em carros de aplicativo' },
  { valor: 'estabelecimentos', rotulo: 'Estabelecimentos', desc: 'Telas em barbearias, padarias, clínicas' },
  { valor: 'financeiro', rotulo: 'Financeiro', desc: 'Lançamentos, repasses e resultado do mês' },
  { valor: 'cobranca', rotulo: 'Cobrança', desc: 'Faturas, lembretes por WhatsApp e baixas' },
  { valor: 'relatorios', rotulo: 'Relatórios', desc: 'Prova de exibição e leituras de QR code' },
]

const cfg = reactive<{ nome: string; modulos: string[]; config: Record<string, any> }>({ nome: '', modulos: [], config: {} })
const usuarios = ref<any[]>([])
const salvando = ref(false)
const novoUsuario = ref(false)
const u = reactive({ nome: '', email: '', senha: '', papel: 'operador' })

function alternar(v: string) {
  const i = cfg.modulos.indexOf(v)
  if (i >= 0) cfg.modulos.splice(i, 1)
  else cfg.modulos.push(v)
}

async function carregar() {
  try {
    const r = await api.get('/config')
    cfg.nome = r.nome
    cfg.modulos = r.modulos || []
    cfg.config = r.config || {}
    if (sessao.usuario?.papel === 'admin') usuarios.value = await api.get('/usuarios')
  } catch (e) {
    erro(e)
  }
}

async function salvar() {
  salvando.value = true
  try {
    await api.put('/config', cfg)
    definirModulos([...cfg.modulos])
    avisar('Configurações salvas')
  } catch (e) {
    erro(e)
  } finally {
    salvando.value = false
  }
}

async function criarUsuario() {
  try {
    await api.post('/usuarios', u)
    avisar('Usuário criado')
    novoUsuario.value = false
    Object.assign(u, { nome: '', email: '', senha: '', papel: 'operador' })
    usuarios.value = await api.get('/usuarios')
  } catch (e) {
    erro(e)
  }
}

async function removerUsuario(x: any) {
  if (!confirm(`Remover ${x.nome}?`)) return
  try {
    await api.del(`/usuarios/${x.id}`)
    usuarios.value = await api.get('/usuarios')
  } catch (e) {
    erro(e)
  }
}

onMounted(carregar)
</script>

<style scoped>
.modulos { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.modulo { display: flex; gap: 10px; padding: 12px 14px; cursor: pointer; box-shadow: none; align-items: flex-start; }
.modulo input { width: auto; margin-top: 3px; }
.modulo.ligado { border-color: var(--laranja); background: var(--laranja-claro); }
.modulo strong { display: block; }
.modulo span { font-size: 0.8rem; color: var(--texto-2); }
.sobre p { margin: 6px 0 0; }
</style>
