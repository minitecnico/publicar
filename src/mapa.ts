/**
 * Leaflet (mapas OpenStreetMap) carregado sob demanda, só nas telas que mostram mapa.
 * Mantém o pacote principal leve e não exige dependência nova no build.
 */
const VERSAO = '1.9.4'
let carregando: Promise<any> | null = null

export function carregarLeaflet(): Promise<any> {
  const w = window as any
  if (w.L) return Promise.resolve(w.L)
  if (carregando) return carregando
  carregando = new Promise((ok, falha) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = `https://unpkg.com/leaflet@${VERSAO}/dist/leaflet.css`
    document.head.appendChild(css)
    const js = document.createElement('script')
    js.src = `https://unpkg.com/leaflet@${VERSAO}/dist/leaflet.js`
    js.onload = () => ok(w.L)
    js.onerror = () => {
      carregando = null
      falha(new Error('Não foi possível carregar o mapa (sem internet?)'))
    }
    document.head.appendChild(js)
  })
  return carregando
}

export function camadaRuas(L: any) {
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
}

export interface Geo { lat: number; lng: number; raio_km?: number }

export const geoValido = (g: unknown): g is Geo =>
  !!g && typeof g === 'object' && Number.isFinite(Number((g as Geo).lat)) && Number.isFinite(Number((g as Geo).lng))

/** Busca de endereço (Nominatim/OpenStreetMap). Uso leve: uma busca por clique. */
export async function buscarEndereco(q: string): Promise<{ nome: string; lat: number; lng: number }[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(q)}`
  const r = await fetch(url)
  if (!r.ok) throw new Error('Busca de endereço indisponível no momento')
  const lista = (await r.json()) as { display_name: string; lat: string; lon: string }[]
  return lista.map((x) => ({ nome: x.display_name, lat: Number(x.lat), lng: Number(x.lon) }))
}
