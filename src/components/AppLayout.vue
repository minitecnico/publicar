<template>
  <div class="layout" :class="{ menuAberto }">
    <aside class="lateral nao-imprimir">
      <RouterLink to="/" class="marca" @click="menuAberto = false">
        <img src="/logo.png" alt="Publicar — o seu outdoor itinerante" />
      </RouterLink>
      <nav>
        <RouterLink
          v-for="item in itens"
          :key="item.rota"
          :to="item.rota"
          class="item"
          :class="{ ativo: ativo(item.rota) }"
          @click="menuAberto = false"
        >
          <Icone :nome="item.icone" />
          <span>{{ item.nome }}</span>
        </RouterLink>
      </nav>
      <div class="rodape-lateral">
        <div class="usuario">
          <div class="avatar">{{ iniciais }}</div>
          <div>
            <strong>{{ sessao.usuario?.nome }}</strong>
            <span>{{ sessao.usuario?.papel === 'admin' ? 'Administrador' : 'Operador' }}</span>
          </div>
        </div>
        <button class="btn fantasma pequeno" title="Sair" @click="logout"><Icone nome="sair" /></button>
      </div>
    </aside>
    <div class="cortina" @click="menuAberto = false" />
    <main>
      <header class="topo nao-imprimir">
        <button class="btn fantasma pequeno" aria-label="Menu" @click="menuAberto = !menuAberto"><Icone nome="menu" /></button>
        <img src="/logo.png" alt="Publicar" class="logo-topo" />
      </header>
      <div class="conteudo">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import { definirModulos, sair, sessao } from '../auth'
import { MENU } from '../router'
import Icone from './Icone.vue'

const route = useRoute()
const router = useRouter()
const menuAberto = ref(false)

const itens = computed(() => MENU.filter((m) => !m.modulo || sessao.modulos.includes(m.modulo)))
const iniciais = computed(() =>
  (sessao.usuario?.nome || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase(),
)
const ativo = (rota: string) => (rota === '/' ? route.path === '/' : route.path.startsWith(rota))

function logout() {
  sair()
  router.push('/login')
}

onMounted(async () => {
  try {
    const cfg = await api.get('/config')
    definirModulos(cfg.modulos)
  } catch {
    /* mantém os módulos em cache */
  }
})
</script>

<style scoped>
.layout { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.lateral { background: var(--branco); border-right: 1px solid var(--borda); display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; }
.marca { display: block; padding: 18px 22px 10px; }
.marca img { width: 128px; display: block; }
nav { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; flex: 1; overflow-y: auto; }
.item { display: flex; align-items: center; gap: 11px; padding: 9px 12px; border-radius: 8px; color: var(--texto-2); text-decoration: none; font-weight: 550; }
.item:hover { background: #f4f3ef; color: var(--texto); }
.item.ativo { background: var(--laranja-claro); color: var(--laranja-escuro); }
.rodape-lateral { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 14px 14px 18px; border-top: 1px solid var(--borda); }
.usuario { display: flex; align-items: center; gap: 10px; min-width: 0; }
.usuario strong { display: block; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.usuario span { font-size: 0.75rem; color: var(--texto-2); }
.avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--grafite); color: var(--laranja); display: grid; place-items: center; font-weight: 700; font-size: 0.8rem; flex-shrink: 0; }
main { min-width: 0; }
.conteudo { padding: 28px 32px 48px; max-width: 1280px; }
.topo { display: none; }
.cortina { display: none; }

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .lateral { position: fixed; left: 0; top: 0; z-index: 300; width: 260px; transform: translateX(-100%); transition: transform 0.2s; }
  .menuAberto .lateral { transform: none; box-shadow: 0 0 40px rgba(0,0,0,.2); }
  .menuAberto .cortina { display: block; position: fixed; inset: 0; background: rgba(0,0,0,.3); z-index: 200; }
  .topo { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--branco); border-bottom: 1px solid var(--borda); position: sticky; top: 0; z-index: 100; }
  .logo-topo { height: 34px; }
  .conteudo { padding: 20px 16px 40px; }
}
@media print {
  .layout { display: block; }
  .conteudo { padding: 0; }
}
</style>
