import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zap da Roça',
    short_name: 'Zap da Roça',
    description: 'Gestão financeira e de mão de obra para produtores rurais pelo WhatsApp',
    start_url: '/app',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070c1a',
    theme_color: '#070c1a',
    categories: ['finance', 'productivity', 'business'],
    lang: 'pt-BR',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
