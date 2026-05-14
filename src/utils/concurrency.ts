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
