import { afterEach, describe, expect, it, vi } from 'vitest'
import { withLoadingTimeout } from './useReferenceData'

describe('withLoadingTimeout', () => {
  afterEach(() => vi.useRealTimers())

  it('encerra o loading quando a consulta não responde', async () => {
    vi.useFakeTimers()
    const result = withLoadingTimeout(new Promise<never>(() => undefined), 100)
    const assertion = expect(result).rejects.toThrow('Tempo limite')
    await vi.advanceTimersByTimeAsync(100)
    await assertion
  })
})
