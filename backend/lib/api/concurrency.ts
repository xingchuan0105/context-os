type Semaphore = {
  max: number
  inFlight: number
  queue: Array<() => void>
}

const semaphores = new Map<string, Semaphore>()

function getSemaphore(key: string, max: number): Semaphore {
  const current = semaphores.get(key)
  if (current) {
    current.max = max
    return current
  }
  const created: Semaphore = { max, inFlight: 0, queue: [] }
  semaphores.set(key, created)
  return created
}

async function acquire(semaphore: Semaphore): Promise<void> {
  if (semaphore.max <= 0) return
  if (semaphore.inFlight < semaphore.max) {
    semaphore.inFlight += 1
    return
  }
  await new Promise<void>((resolve) => {
    semaphore.queue.push(resolve)
  })
}

function release(semaphore: Semaphore): void {
  if (semaphore.max <= 0) return
  semaphore.inFlight = Math.max(0, semaphore.inFlight - 1)
  const next = semaphore.queue.shift()
  if (next) {
    semaphore.inFlight += 1
    next()
  }
}

export async function withConcurrencyLimit<T>(
  key: string,
  max: number,
  fn: () => Promise<T>
): Promise<T> {
  const semaphore = getSemaphore(key, max)
  await acquire(semaphore)
  try {
    return await fn()
  } finally {
    release(semaphore)
  }
}
