// Ponto de entrada das Cloudflare Pages Functions: toda requisição /api/* cai aqui.
import { handle } from 'hono/cloudflare-pages'
import { app } from '../../server/app'

export const onRequest = handle(app)
