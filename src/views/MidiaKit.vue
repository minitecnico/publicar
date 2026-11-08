<template>
  <div class="kit">
    <p v-if="!k" class="mudo centro">{{ falha || 'Carregando…' }}</p>
    <template v-else>
      <header class="capa">
        <img src="/logo.png" alt="" class="logo" />
        <div>
          <span class="rotulo">Mídia kit</span>
          <h1>{{ k.empresa }}</h1>
          <p>Mídia em telas dentro de carros de aplicativo e em estabelecimentos{{ k.cidade ? ` · ${k.cidade}` : '' }}.</p>
        </div>
        <a v-if="whats" class="btn destaque nao-imprimir" :href="whats" target="_blank" rel="noopener">Falar com o comercial</a>
      </header>

      <section class="numeros">
        <div><strong>{{ numero(k.telas.total) }}</strong><span>telas ativas</span><em>{{ k.telas.carros }} em carros · {{ k.telas.estabelecimentos }} em estabelecimentos</em></div>
        <div><strong>{{ numero(k.bairros.length) }}</strong><span>bairros/regiões</span></div>
        <div class="destaque"><strong>{{ numero(k.pessoas_dia) }}</strong><span>pessoas por dia</span><em>diante das telas (estimativa)</em></div>
        <div><strong>{{ numero(k.pessoas_mes) }}</strong><span>pessoas por mês</span></div>
      </section>

      <section class="bloco">
        <h2>Por que funciona</h2>
        <ul class="motivos">
          <li><b>Audiência cativa:</b> o passageiro fica em média vários minutos de frente para a tela, sem pular o anúncio.</li>
          <li><b>Prova de exibição:</b> relatório ao vivo por dia, hora, região e peça, com link para o anunciante.</li>
          <li><b>Resultado medido:</b> QR code rastreado e cupom exclusivo validado na loja (prova de venda).</li>
          <li><b>Segmentação:</b> por bairro, dia da semana e horário; troca de arte a qualquer momento.</li>
        </ul>
      </section>

      <section v-if="k.pacotes.length" class="bloco">
        <h2>Pacotes</h2>
        <div class="pacotes">
          <article v-for="p in k.pacotes" :key="p.nome" class="pacote">
            <h3>{{ p.nome }}</h3>
            <p v-if="p.descricao" class="mudo">{{ p.descricao }}</p>
            <ul>
              <li><b>{{ p.telas }}</b> telas{{ p.bairros?.length && p.bairros.length <= 4 ? ` · ${p.bairros.join(', ')}` : '' }}</li>
              <li>Espaço de <b>{{ p.duracao }}s</b>{{ p.prioridade > 1 ? ` × ${p.prioridade} por ciclo` : '' }} · {{ resumoVeiculacao(p) }}</li>
              <li>≈ <b>{{ numero(p.impactos_mes) }}</b> impactos por mês</li>
              <li v-if="p.ocupacao >= 70" class="quente">Alta procura: {{ p.ocupacao }}% vendido</li>
            </ul>
            <div class="preco">{{ moeda(p.preco) }}<span>/mês</span></div>
            <div v-if="p.cpm" class="mudo pequeno">CPM {{ moeda(p.cpm) }}</div>
          </article>
        </div>
      </section>

      <div class="duas">
        <section class="bloco">
          <h2>Onde estamos</h2>
          <table class="tabela">
            <thead><tr><th>Bairro / região</th><th class="num">Carros</th><th class="num">Estab.</th><th class="num">Pessoas/dia</th></tr></thead>
            <tbody><tr v-for="b in k.bairros" :key="b.bairro"><td>{{ b.bairro }}</td><td class="num">{{ b.carros }}</td><td class="num">{{ b.estabelecimentos }}</td><td class="num">{{ numero(b.pessoas_dia) }}</td></tr></tbody>
          </table>
        </section>
        <section class="bloco">
          <h2>Especificações da peça</h2>
          <ul class="specs">
            <li><b>Formato:</b> 1920 × 1080 px, paisagem (16:9)</li>
            <li><b>Imagem:</b> JPG, PNG ou WEBP</li>
            <li><b>Vídeo:</b> MP4 até 25 MB, com a duração do espaço (10, 15 ou 30 s), sem depender de som</li>
            <li><b>Texto:</b> até 7 palavras no título, letra grande e alto contraste</li>
            <li><b>QR code:</b> colocado pela tela no canto inferior direito; deixe essa área livre</li>
            <li><b>Sem arte pronta?</b> Criamos para você.</li>
          </ul>
        </section>
      </div>

      <footer class="rodape-kit">
        Números atualizados em {{ hojeFmt }}. Pessoas por dia = estimativa de audiência a partir de corridas, passageiros e fluxo de cada ponto.
        <button class="btn nao-imprimir" @click="imprimir">Imprimir / salvar PDF</button>
      </footer>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { moeda, numero, resumoVeiculacao } from '../format'

const route = useRoute()
const k = ref<any>(null)
const falha = ref('')
const hojeFmt = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })
const whats = computed(() => {
  const d = String(k.value?.whatsapp || '').replace(/\D/g, '')
  if (!d) return ''
  const n = d.length <= 11 ? `55${d}` : d
  return `https://wa.me/${n}?text=${encodeURIComponent(`Olá! Vi o mídia kit da ${k.value.empresa} e quero anunciar.`)}`
})
const imprimir = () => window.print()

onMounted(async () => {
  try {
    const r = await fetch(`/api/publico/midiakit/${encodeURIComponent(String(route.params.token))}`, { cache: 'no-store' })
    const corpo = await r.json()
    if (!r.ok) { falha.value = corpo.erro || 'Mídia kit indisponível'; return }
    k.value = corpo
    document.title = `Mídia kit · ${corpo.empresa}`
  } catch {
    falha.value = 'Sem conexão. Tente de novo.'
  }
})
</script>

<style scoped>
.kit { max-width: 1040px; margin: 0 auto; padding: 28px 16px 48px; }
.centro { text-align: center; margin-top: 20vh; }
.capa { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; background: var(--grafite); color: #fff; border-radius: 18px; padding: 26px 28px; }
.capa > div { flex: 1; min-width: 240px; }
.capa .logo { width: 96px; height: 96px; object-fit: contain; background: #fff; border-radius: 16px; padding: 8px; }
.rotulo { font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--laranja); font-weight: 800; }
.capa h1 { margin: 4px 0 6px; font-size: 2rem; }
.capa p { margin: 0; color: rgba(255, 255, 255, 0.8); }
.numeros { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; }
.numeros div { background: var(--branco); border: 1px solid var(--borda); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 2px; }
.numeros strong { font-size: 1.9rem; font-variant-numeric: tabular-nums; }
.numeros span { font-weight: 600; }
.numeros em { font-style: normal; font-size: 0.78rem; color: var(--texto-2); }
.numeros .destaque { background: var(--laranja-claro); border-color: #f3d3a6; }
.bloco { margin-top: 22px; }
.bloco h2 { font-size: 1.15rem; margin: 0 0 10px; }
.motivos, .specs { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; color: var(--texto); }
.pacotes { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.pacote { background: var(--branco); border: 1px solid var(--borda); border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; break-inside: avoid; }
.pacote h3 { margin: 0; font-size: 1.1rem; }
.pacote p { margin: 0; font-size: 0.88rem; }
.pacote ul { margin: 4px 0; padding-left: 16px; font-size: 0.9rem; display: flex; flex-direction: column; gap: 3px; }
.pacote .quente { color: var(--vermelho); font-weight: 600; }
.preco { font-size: 1.6rem; font-weight: 800; margin-top: auto; }
.preco span { font-size: 0.85rem; font-weight: 500; color: var(--texto-2); }
.duas { display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; }
.rodape-kit { margin-top: 26px; font-size: 0.8rem; color: var(--texto-2); display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
@media (max-width: 760px) { .numeros { grid-template-columns: 1fr 1fr; } .duas { grid-template-columns: 1fr; } }
@media print { .capa { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
