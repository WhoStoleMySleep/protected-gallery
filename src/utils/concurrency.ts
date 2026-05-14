const MAX = 2
let running = 0
const queue: Array<() => void> = []

const next = () => {
  if (queue.length > 0 && running < MAX) queue.shift()!()
}

export const limit = <T>(fn: () => Promise<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    const run = () => {
      running++
      fn().then(resolve, reject).finally(() => {
        running--
        next()
      })
    }
    if (running < MAX) run()
    else queue.push(run)
  })
