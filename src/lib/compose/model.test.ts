import { describe, it, expect } from 'vitest'
import { pickComposeModel, modelSupportsXSearch } from './model'
import type { VeniceModel } from '../../types/venice'

function model(id: string, xSearch?: boolean): VeniceModel {
  return {
    id,
    object: 'model',
    created: 0,
    owned_by: 'venice',
    model_spec: { capabilities: { supportsXSearch: xSearch } },
  }
}

describe('pickComposeModel', () => {
  it('returns undefined when no model supports X search', () => {
    expect(pickComposeModel([model('a'), model('b', false)])).toBeUndefined()
  })

  it('prefers a grok model among x-search-capable models', () => {
    const models = [model('llama-x', true), model('grok-4', true), model('other', true)]
    expect(pickComposeModel(models)).toBe('grok-4')
  })

  it('falls back to the first x-search-capable model when no grok', () => {
    const models = [model('no', false), model('search-model', true)]
    expect(pickComposeModel(models)).toBe('search-model')
  })
})

describe('modelSupportsXSearch', () => {
  it('reflects the capability flag for a given id', () => {
    const models = [model('grok-4', true), model('plain', false)]
    expect(modelSupportsXSearch(models, 'grok-4')).toBe(true)
    expect(modelSupportsXSearch(models, 'plain')).toBe(false)
    expect(modelSupportsXSearch(models, 'missing')).toBe(false)
  })
})
