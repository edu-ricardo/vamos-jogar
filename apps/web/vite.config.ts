import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      workbox: {
        // Navegações para a API e o PocketBase (ex.: retorno do login Google) vão ao servidor,
        // em vez de o service worker responder com o index.html do app
        navigateFallbackDenylist: [/^\/api\//, /^\/pb\//],
        // Recebe as notificações (Web Push) e abre o evento ao tocar
        importScripts: ['push-sw.js'],
      },
      manifest: {
        name: 'Vamos Jogar!',
        short_name: 'Vamos Jogar',
        description: 'Organize suas jogatinas com os amigos',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.jpg',
            sizes: '192x192',
            type: 'image/jpeg',
          },
          {
            src: 'pwa-512x512.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});
