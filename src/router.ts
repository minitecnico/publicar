import { createRouter, createWebHistory } from 'vue-router'
import { sessao } from './auth'

export const MENU = [
  { rota: '/', nome: 'Painel', icone: 'painel', modulo: null },
  { rota: '/campanhas', nome: 'Campanhas', icone: 'campanha', modulo: null },
  { rota: '/clientes', nome: 'Clientes', icone: 'clientes', modulo: null },
  { rota: '/telas', nome: 'Telas', icone: 'tela', modulo: null },
  { rota: '/motoristas', nome: 'Motoristas', icone: 'motorista', modulo: 'mobilidade' },
  { rota: '/financeiro', nome: 'Financeiro', icone: 'financeiro', modulo: 'financeiro' },
  { rota: '/cobranca', nome: 'Cobrança', icone: 'cobranca', modulo: 'cobranca' },
  { rota: '/relatorios', nome: 'Relatórios', icone: 'relatorio', modulo: 'relatorios' },
  { rota: '/configuracoes', nome: 'Configurações', icone: 'config', modulo: null },
] as const

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('./views/Login.vue'), meta: { publica: true } },
    { path: '/configurar', component: () => import('./views/Setup.vue'), meta: { publica: true } },
    { path: '/tela', component: () => import('./views/Player.vue'), meta: { publica: true } },
    { path: '/tela/:codigo', component: () => import('./views/Player.vue'), meta: { publica: true } },
    {
      path: '/',
      component: () => import('./components/AppLayout.vue'),
      children: [
        { path: '', component: () => import('./views/Dashboard.vue') },
        { path: 'campanhas', component: () => import('./views/Campanhas.vue') },
        { path: 'clientes', component: () => import('./views/Clientes.vue') },
        { path: 'telas', component: () => import('./views/Telas.vue') },
        { path: 'motoristas', component: () => import('./views/Motoristas.vue') },
        { path: 'financeiro', component: () => import('./views/Financeiro.vue') },
        { path: 'cobranca', component: () => import('./views/Cobranca.vue') },
        { path: 'relatorios', component: () => import('./views/Relatorios.vue') },
        { path: 'configuracoes', component: () => import('./views/Configuracoes.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  if (to.meta.publica) return true
  if (sessao.token) return true
  try {
    const r = await fetch('/api/auth/status').then((x) => x.json())
    if (r.precisaConfigurar) return '/configurar'
  } catch {
    /* sem rede: vai para o login */
  }
  return '/login'
})
