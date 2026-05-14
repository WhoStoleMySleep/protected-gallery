const mulberry32 = (seed: number) => {
  return () => {
    seed |= 0
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const dateToSeed = (dateStr: string): number => {
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i)
    hash |= 0
  }
  return hash
}

export const getTodayKey = (): string => new Date().toISOString().slice(0, 10)

export const selectDaily = (allIds: string[], count = 25, date = getTodayKey()): string[] => {
  if (allIds.length === 0) return []
  if (allIds.length <= count) return [...allIds]

  const rng = mulberry32(dateToSeed(date))
  const shuffled = [...allIds]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}
