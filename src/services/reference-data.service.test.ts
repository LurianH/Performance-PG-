import { describe, expect, it } from 'vitest'
import { mapWithConcurrency } from './reference-data.service'

describe('mapWithConcurrency', () => {
  it('preserva a ordem e limita o fan-out das consultas DMC', async () => {
    let active = 0
    let peak = 0
    const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (value) => {
      active += 1
      peak = Math.max(peak, active)
      await Promise.resolve()
      active -= 1
      return value * 10
    })
    expect(result).toEqual([10, 20, 30, 40, 50, 60])
    expect(peak).toBeLessThanOrEqual(2)
  })
})
