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

      <h2 class="secao">Programação e conteúdo</h2>
      <p class="mudo pequeno" style="margin: 4px 0 12px">
        Conteúdo prende a atenção da plateia e valoriza o anúncio. Recomendado: ciclo de 300s com 60% de conteúdo (120s vendáveis = 8 espaços de 15s).
      </p>
      <div class="grade-form">
        <label class="campo">Conteúdo mínimo no ciclo (%)
          <input v-model.number="cfg.config.conteudo_pct" type="number" min="0" max="80" step="5" placeholder="0" />
          <span class="dica">
            Vendável por ciclo: <strong>{{ vendavel }}s</strong> de {{ cfg.config.ciclo_segundos || 120 }}s. O resto é conteúdo (clima, notícias, promoções…).
          </span>
        </label>
        <label class="campo">Cidade (clima e notícias)
          <input v-model="cfg.config.cidade" type="text" placeholder="Ex.: Feira de Santana - BA" />
          <span class="dica">Nome da cidade e UF. As manchetes são da imprensa local, atualizadas a cada 30 min.</span>
        </label>
      </div>
      <h3 class="sub">Patrocínio dos quadros</h3>
      <p class="mudo pequeno" style="margin: 2px 0 10px">Ex.: "Clima oferecido por Farmácia X". Aparece no rodapé do quadro, com o logo. Vazio = sem patrocínio.</p>
      <div class="patrocinios">
        <div v-for="w in QUADROS" :key="w.valor" class="patrocinio">
          <strong>{{ w.rotulo }}</strong>
          <input v-model="patrocinio(w.valor).nome" type="text" placeholder="Nome do patrocinador" />
          <MediaInput v-model="patrocinio(w.valor).logo_url" tipo="imagem" />
        </div>
      </div>

      <h2 class="secao">Alertas de tela offline (WhatsApp)</h2>
      <p class="mudo pequeno" style="margin: 4px 0 12px">
        Tela apagada é dinheiro perdido. O sistema confere a cada 15 min e avisa uma vez por queda, só no horário de operação, e avisa quando a tela volta.
        Envio gratuito pelo <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noopener">CallMeBot</a>:
        adicione o número dele no seu WhatsApp, mande "I allow callmebot to send me messages" e cole aqui a apikey que ele responder.
      </p>
      <div class="grade-form">
        <label class="campo check-linha"><input v-model="alertas.ativo" type="checkbox" /> Alertas ligados</label>
        <label class="campo">Avisar após (minutos sem sinal)<input v-model.number="alertas.minutos" type="number" min="15" max="240" step="5" /></label>
        <label class="campo">Seu WhatsApp<input v-model="alertas.telefone" type="tel" placeholder="(75) 99999-0000" /></label>
        <label class="campo">Apikey do CallMeBot<input v-model="alertas.apikey" type="text" autocomplete="off" /></label>
        <label class="campo">Operação começa<input v-model="alertas.inicio" type="time" /></label>
        <label class="campo">Operação termina<input v-model="alertas.fim" type="time" /></label>
        <label class="campo inteira">Webhook (opcional)
          <input v-model="alertas.webhook" type="url" placeholder="https://… recebe POST {texto}" />
          <span class="dica">Para integrar com outro sistema (Z-API, n8n, Make…).</span>
        </label>
      </div>
      <div class="linha" style="margin-top: 10px"><button type="button" class="btn pequeno" @click="testarAlerta">Enviar mensagem de teste</button></div>

      <h3 class="sub">Bônus do repasse por hora (por nível do motorista)</h3>
      <div class="grade-form bonus">
        <label class="campo">Bronze (%)<input v-model.number="bonus.bronze" type="number" min="0" max="100" /></label>
        <label class="campo">Prata (%)<input v-model.number="bonus.prata" type="number" min="0" max="100" /></label>
        <label class="campo">Ouro (%)<input v-model.number="bonus.ouro" type="number" min="0" max="100" /></label>
      </div>

      <h2 class="secao">Audiência (padrões)</h2>
      <p class="mudo pequeno" style="margin: 4px 0 12px">
        Usados nas telas que não têm números próprios. Metodologia: público no momento = pessoas por dia ÷ horas ligada × minutos diante
        da tela; impactos = exibições × público no momento × visibilidade. É a conta que agências usam para comparar CPM.
      </p>
      <div class="aud">
        <fieldset>
          <legend>Carros de aplicativo</legend>
          <label class="campo">Corridas por dia <input v-model.number="aud.carro.corridas" type="number" step="any" min="0" /></label>
          <label class="campo">Passageiros por corrida <input v-model.number="aud.carro.passageiros" type="number" step="any" min="0" /></label>
          <label class="campo">Duração média da corrida (min) <input v-model.number="aud.carro.permanencia" type="number" step="any" min="1" /></label>
          <label class="campo">Horas rodando por dia <input v-model.number="aud.carro.horas" type="number" step="any" min="1" max="24" /></label>
          <label class="campo">Visibilidade (0 a 1) <input v-model.number="aud.carro.visibilidade" type="number" step="0.05" min="0.05" max="1" />
            <span class="dica">Tablet no encosto, de frente para o passageiro: 0,9.</span></label>
        </fieldset>
        <fieldset>
          <legend>Estabelecimentos</legend>
          <label class="campo">Pessoas por dia <input v-model.number="aud.estabelecimento.fluxo" type="number" step="any" min="0" /></label>
          <label class="campo">Tempo médio de espera (min) <input v-model.number="aud.estabelecimento.permanencia" type="number" step="any" min="1" /></label>
          <label class="campo">Horas aberto por dia <input v-model.number="aud.estabelecimento.horas" type="number" step="any" min="1" max="24" /></label>
          <label class="campo">Visibilidade (0 a 1) <input v-model.number="aud.estabelecimento.visibilidade" type="number" step="0.05" min="0.05" max="1" />
            <span class="dica">TV na sala de espera, nem sempre no campo de visão: 0,5.</span></label>
        </fieldset>
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
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import { comPadrao, type PadroesAudiencia } from '../audiencia'
import { definirModulos, sessao } from '../auth'
import Icone from '../components/Icone.vue'
import MediaInput from '../components/MediaInput.vue'
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
const aud = reactive<PadroesAudiencia>(comPadrao(null))
const ALERTA_PADRAO = { ativo: false, minutos: 30, telefone: '', apikey: '', inicio: '07:00', fim: '22:00', webhook: '' }
const alertas = reactive({ ...ALERTA_PADRAO })
const bonus = reactive({ bronze: 0, prata: 10, ouro: 20 })
async function testarAlerta() {
  try {
    await api.post('/alertas/teste', { ...alertas })
    avisar('Mensagem de teste enviada: confira seu WhatsApp')
  } catch (e) {
    erro(e)
  }
}
const QUADROS = [
  { valor: 'clima', rotulo: 'Clima' },
  { valor: 'cotacao', rotulo: 'Dólar e euro' },
  { valor: 'noticias', rotulo: 'Notícias' },
  { valor: 'esportes', rotulo: 'Esportes' },
  { valor: 'curiosidades', rotulo: 'Você sabia?' },
]
/** Garante um registro de patrocínio por quadro (criado no carregamento, nunca durante a renderização). */
function garantirPatrocinios() {
  const p = (cfg.config.patrocinios ||= {})
  for (const q of QUADROS) p[q.valor] ||= { nome: '', logo_url: '' }
}
garantirPatrocinios()
const patrocinio = (w: string): { nome: string; logo_url: string } => cfg.config.patrocinios[w]
const vendavel = computed(() => {
  const ciclo = Number(cfg.config.ciclo_segundos) || 120
  const pct = Math.min(80, Math.max(0, Number(cfg.config.conteudo_pct) || 0))
  return Math.round((ciclo * (100 - pct)) / 100)
})
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
    Object.assign(aud, comPadrao(cfg.config.audiencia))
    Object.assign(alertas, ALERTA_PADRAO, cfg.config.alertas || {})
    Object.assign(bonus, { bronze: 0, prata: 10, ouro: 20 }, cfg.config.bonus_nivel || {})
    garantirPatrocinios()
    if (sessao.usuario?.papel === 'admin') usuarios.value = await api.get('/usuarios')
  } catch (e) {
    erro(e)
  }
}

async function salvar() {
  salvando.value = true
  try {
    cfg.config.audiencia = JSON.parse(JSON.stringify(aud))
    cfg.config.alertas = { ...alertas }
    cfg.config.bonus_nivel = { ...bonus }
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
.sub { margin: 16px 0 8px; font-size: 0.95rem; }
.check-linha { flex-direction: row; align-items: center; gap: 8px; }
.check-linha input { width: auto; }
.bonus { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.patrocinios { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.patrocinio { border: 1px solid var(--borda); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.aud { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.aud fieldset { border: 1px solid var(--borda); border-radius: 10px; padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 10px; margin: 0; }
.aud legend { font-weight: 700; padding: 0 6px; }
@media (max-width: 700px) { .aud { grid-template-columns: 1fr; } }
</style>
