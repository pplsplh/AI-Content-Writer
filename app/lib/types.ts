export type HistoryItem = {
  id: string
  topic: string
  contentType: string
  mood: string | null
  aiModel: string
  result: string
  timestamp: number
  favorite?: boolean
}
