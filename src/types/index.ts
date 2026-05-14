export interface VaultFile {
  id: string
  originalName: string
  mimeType: string
  size: number
  importedAt: number
  encryptedPath: string
  thumbPath?: string
  width?: number
  height?: number
  duration?: number
}

export type MainTab = 'daily' | 'import' | 'settings'
export type ViewerReturn = MainTab | 'allMedia'

export type AppScreen =
  | { name: 'loading' }
  | { name: 'pinSetup' }
  | { name: 'pinEntry' }
  | { name: 'daily' }
  | { name: 'import' }
  | { name: 'settings' }
  | { name: 'changePin' }
  | { name: 'allMedia' }
  | { name: 'viewer'; fileIds: string[]; initialIndex: number; returnTo: ViewerReturn }
