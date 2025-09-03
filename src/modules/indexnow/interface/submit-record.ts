export interface SubmitRecordItem {
  url: string
  submitTime: Date
}

export interface SubmitRecord {
  items: SubmitRecordItem[]
  total: number
  success: boolean
  error?: string
  finishedAt: Date
}
