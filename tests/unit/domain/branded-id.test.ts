import { describe, expect, it } from 'vitest'
import { isPrefixedId } from '../../../src/domain/branded-id'

describe('isPrefixedId', () => {
  it('accepts a well-formed id with the matching prefix', () => {
    expect(isPrefixedId('msg', 'msg_01J8XA1B2C3D4E5F6G7H8J9K0M')).toBe(true)
  })

  it('rejects a well-formed id with a different prefix', () => {
    expect(isPrefixedId('chan', 'msg_01J8XA1B2C3D4E5F6G7H8J9K0M')).toBe(false)
  })

  it('rejects a value with the right prefix but wrong suffix shape', () => {
    expect(isPrefixedId('msg', 'msg_not-a-valid-id')).toBe(false)
  })

  it('rejects a value with no prefix at all', () => {
    expect(isPrefixedId('msg', '01J8XA1B2C3D4E5F6G7H8J9K0M')).toBe(false)
  })
})
