<template>
  <div class="midia">
    <div class="linha">
      <input :value="modelValue" type="text" placeholder="Envie um arquivo ou cole um link (https://…)" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
      <label class="btn" :class="{ desabilitado: enviando }">
        <Icone nome="upload" /> {{ enviando ? 'Enviando…' : 'Enviar' }}
        <input type="file" :accept="aceitar" hidden :disabled="enviando" @change="enviar" />
      </label>
    </div>
    <div v-if="modelValue && tipo !== 'youtube'" class="previa">
      <video v-if="ehVideo" :src="modelValue" muted controls preload="metadata" />
      <img v-else :src="modelValue" alt="Prévia da mídia" />
    </div>
    <p class="dica">{{ dica }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { api } from '../api'
import { avisar, erro } from '../toast'
import Icone from './Icone.vue'

const props = defineProps<{ modelValue?: string | null; tipo?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string]; tipoDetectado: [string] }>()
const enviando = ref(false)

const aceitar = computed(() => (props.tipo === 'video' ? 'video/mp4,video/webm' : props.tipo === 'imagem' ? 'image/*' : 'image/*,video/mp4,video/webm'))
const ehVideo = computed(() => props.tipo === 'video' || /\.(mp4|webm)(\?|$)/i.test(props.modelValue || ''))
const dica = computed(() =>
  props.tipo === 'youtube'
    ? 'Cole o link do vídeo no YouTube. Atenção: exibição pública exige direitos sobre o vídeo.'
    : 'Imagens PNG/JPG/WEBP ou vídeos MP4/WEBM de até 25 MB. Formato ideal: 1280×800 (paisagem).',
)

async function enviar(e: Event) {
  const input = e.target as HTMLInputElement
  const arq = input.files?.[0]
  if (!arq) return
  enviando.value = true
  try {
    const r = await api.upload(arq)
    emit('update:modelValue', r.url)
    emit('tipoDetectado', r.tipo.startsWith('video') ? 'video' : 'imagem')
    avisar('Arquivo enviado')
  } catch (err) {
    erro(err)
  } finally {
    enviando.value = false
    input.value = ''
  }
}
</script>

<style scoped>
.midia { display: flex; flex-direction: column; gap: 8px; }
.desabilitado { opacity: 0.6; pointer-events: none; }
.previa { border: 1px solid var(--borda); border-radius: 8px; background: #111; overflow: hidden; max-width: 320px; aspect-ratio: 16 / 10; display: grid; place-items: center; }
.previa img, .previa video { max-width: 100%; max-height: 100%; object-fit: contain; }
.dica { margin: 0; }
</style>
