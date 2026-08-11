import { describe, expect, it } from 'vitest'
import { detailLoaders, getPageLoader, pageLoaders } from './appRoutes'

describe('page route loaders', () => {
  it('maps every sidebar page to a lazy module loader', () => {
    expect(Object.keys(pageLoaders).sort()).toEqual([
      'billing',
      'calendar',
      'cases',
      'clients',
      'consultation',
      'dashboard',
      'docs',
      'preservation',
      'retainers',
      'settings',
    ])
  })

  it('selects detail loaders only when a detail id is present', () => {
    expect(getPageLoader({ page: 'cases', caseId: 42 })).toBe(detailLoaders.caseDetail)
    expect(getPageLoader({ page: 'cases' })).toBe(pageLoaders.cases)
    expect(getPageLoader({ page: 'retainers', retainerId: 9 })).toBe(detailLoaders.retainerDetail)
    expect(getPageLoader({ page: 'retainers' })).toBe(pageLoaders.retainers)
  })

  it('loads real page modules with default components', async () => {
    const modules = await Promise.all([
      pageLoaders.dashboard(),
      pageLoaders.calendar(),
      pageLoaders.settings(),
    ])

    expect(modules.every((module) => typeof module.default === 'function')).toBe(true)
  })

})
