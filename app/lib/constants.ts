export const MOODS = [
  { label: 'Senang',   emoji: '😊', value: 'joyful and uplifting'       },
  { label: 'Sedih',    emoji: '😢', value: 'melancholic and heartfelt'   },
  { label: 'Rindu',    emoji: '💭', value: 'nostalgic and longing'       },
  { label: 'Marah',    emoji: '😤', value: 'fierce and passionate'       },
  { label: 'Kesal',    emoji: '😒', value: 'frustrated and blunt'        },
  { label: 'Excited',  emoji: '🤩', value: 'energetic and enthusiastic'  },
  { label: 'Damai',    emoji: '💫', value: 'calm and serene'             },
  { label: 'Galau',    emoji: '😰', value: 'conflicted and emotional'    },
] as const

export const CONTENT_TYPES = ['Caption Instagram', 'Artikel Blog', 'Deskripsi Produk'] as const

export const EXAMPLE_TOPICS = [
  'Kopi di bawah langit malam yang tenang',
  'Sepatu lama yang menemani perjalanan panjang',
  'Produk skincare natural untuk kulit sensitif',
  'Cara memulai kebiasaan membaca setiap hari',
  'Momen pagi hari sebelum dunia terbangun',
  'Hujan pertama setelah musim panas yang panjang',
]

export const AGENT_STEPS = [
  null,
  { icon: '🔍', text: 'Sedang riset topik...' },
  { icon: '📚', text: 'Mengumpulkan referensi...' },
  { icon: '✍️', text: 'Menyusun draft...' },
] as const

export const MAX_CHARS    = 300
export const MAX_HISTORY  = 20
export const HISTORY_KEY  = 'ai-content-writer-history'
export const DRAFT_KEY    = 'ai-content-writer-draft'
