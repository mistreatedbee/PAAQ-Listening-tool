import { describe, expect, it } from 'vitest'
import { canRemoveProject } from './project-removal'

describe('canRemoveProject', () => {
  it('allows owner and admin', () => {
    expect(canRemoveProject('owner')).toBe(true)
    expect(canRemoveProject('admin')).toBe(true)
  })

  it('denies other roles and missing role', () => {
    expect(canRemoveProject('developer')).toBe(false)
    expect(canRemoveProject('product_manager')).toBe(false)
    expect(canRemoveProject('viewer')).toBe(false)
    expect(canRemoveProject(null)).toBe(false)
    expect(canRemoveProject(undefined)).toBe(false)
  })
})
