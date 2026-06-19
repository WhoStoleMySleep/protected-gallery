const yield_ = () => new Promise<void>(r => setTimeout(r, 0))

export const loadInBatches = async <T>(
  ids: string[],
  loader: (id: string) => Promise<T | null>,
  batchSize = 50,
): Promise<T[]> => {
  const results: (T | null)[] = []
  for (let i = 0; i < ids.length; i += batchSize) {
    const loaded = await Promise.all(ids.slice(i, i + batchSize).map(loader))
    results.push(...loaded)
    await yield_()
  }
  return results.filter((r): r is T => r !== null)
}

const MAX = 2
let running = 0
const high: Array<() => void> = []
const normal: Array<() => void> = []

const next = () => {
  const queue = high.length > 0 ? high : normal
  if (queue.length > 0 && running < MAX) queue.shift()!()
}

export const limit = <T>(fn: () => Promise<T>, priority: 'high' | 'normal' = 'normal'): Promise<T> =>
  new Promise((resolve, reject) => {
    const run = () => {
      running++
      fn().then(resolve, reject).finally(() => { running--; next() })
    }
    if (running < MAX) run()
    else (priority === 'high' ? high : normal).push(run)
  })
