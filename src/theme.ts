export interface Colors {
  background: string
  card: string
  cardAlt: string
  accent: string
  accentDim: string
  text: string
  subtext: string
  subtextLight: string
  danger: string
  success: string
  border: string
  overlay: string
}

export const DARK_COLORS: Colors = {
  background: '#0a0a0a',
  card: '#1a1a1a',
  cardAlt: '#222222',
  accent: '#6366f1',
  accentDim: '#4f46e5',
  text: '#f1f5f9',
  subtext: '#64748b',
  subtextLight: '#94a3b8',
  danger: '#ef4444',
  success: '#10b981',
  border: '#2a2a2a',
  overlay: 'rgba(0,0,0,0.85)',
}

export const LIGHT_COLORS: Colors = {
  background: '#f1f5f9',
  card: '#ffffff',
  cardAlt: '#e2e8f0',
  accent: '#6366f1',
  accentDim: '#4f46e5',
  text: '#0f172a',
  subtext: '#64748b',
  subtextLight: '#94a3b8',
  danger: '#ef4444',
  success: '#10b981',
  border: '#cbd5e1',
  overlay: 'rgba(0,0,0,0.55)',
}

// Kept for non-component usage (crypto, storage layers that don't need theming)
export const COLORS = DARK_COLORS
