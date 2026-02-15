/**
 * Cloudflare Worker for vite-shadcn-template
 *
 * This worker serves the SPA and provides optional API endpoints.
 * The SPA assets are automatically served by Cloudflare's asset handling
 * with single-page-application mode enabled.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'

// Define the Cloudflare environment interface
interface Env {
  ASSETS: Fetcher
  ENVIRONMENT: string
}

const app = new Hono<{ Bindings: Env }>()

// Enable CORS for all routes
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
)

// Catch-all route for SPA
// This will only be reached if the request doesn't match any static assets
// and doesn't match any of the API routes above
app.get('*', async () => {
  // For navigation requests, let Cloudflare handle SPA routing automatically
  // This fallback is mainly for non-navigation requests that don't match assets
  return new Response('Not Found', { status: 404 })
})

export default app
