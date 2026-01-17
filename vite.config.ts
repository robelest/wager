import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

export default defineConfig({
  server: {
    port: 3000,
  },
  // Use PUBLIC_ prefix for client-exposed env vars instead of VITE_
  envPrefix: 'PUBLIC_',
  // Required for Better Auth + Convex SSR compatibility
  ssr: {
    noExternal: ['@convex-dev/better-auth'],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart(),
    viteReact(),
    nitro(),
  ],
})
