<template>
  <svg :width="tamanho" :height="tamanho" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="nome === 'painel'"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></template>
    <template v-else-if="nome === 'campanha'"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></template>
    <template v-else-if="nome === 'clientes'"><path d="M3 21V8l9-5 9 5v13" /><path d="M9 21v-6h6v6" /><path d="M3 21h18" /></template>
    <template v-else-if="nome === 'tela'"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></template>
    <template v-else-if="nome === 'motorista'"><path d="M5 17h14M6 17l1.5-6h9L18 17" /><circle cx="8" cy="17" r="2" /><circle cx="16" cy="17" r="2" /><path d="M9 11V8h6v3" /></template>
    <template v-else-if="nome === 'financeiro'"><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></template>
    <template v-else-if="nome === 'cobranca'"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></template>
    <template v-else-if="nome === 'relatorio'"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></template>
    <template v-else-if="nome === 'config'"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></template>
    <template v-else-if="nome === 'grade'"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></template>
    <template v-else-if="nome === 'sair'"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></template>
    <template v-else-if="nome === 'mais'"><path d="M12 5v14M5 12h14" /></template>
    <template v-else-if="nome === 'menu'"><path d="M3 6h18M3 12h18M3 18h18" /></template>
    <template v-else-if="nome === 'busca'"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></template>
    <template v-else-if="nome === 'whatsapp'"><path d="M20.5 3.5A11 11 0 0 0 3.6 17.2L2 22l4.9-1.6A11 11 0 0 0 20.5 3.5Z" /><path d="M8.5 8.5c.5 2.5 2.5 5 5 6l1.5-1.5 2 1-.5 2c-4 .5-8.5-4-8-8l2-.5 1 2Z" /></template>
    <template v-else-if="nome === 'link'"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></template>
    <template v-else-if="nome === 'qr'"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></template>
    <template v-else-if="nome === 'upload'"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5M12 3v12" /></template>
    <template v-else-if="nome === 'x'"><path d="M18 6 6 18M6 6l12 12" /></template>
    <template v-else-if="nome === 'check'"><path d="M20 6 9 17l-5-5" /></template>
    <template v-else-if="nome === 'imprimir'"><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></template>
    <template v-else><circle cx="12" cy="12" r="9" /></template>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ nome: string; tamanho?: number }>(), { tamanho: 18 })
</script>
