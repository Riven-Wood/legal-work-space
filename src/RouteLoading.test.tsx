import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RouteLoading } from './appRoutes'

describe('RouteLoading', () => {
  it('renders an accessible status while a page chunk loads', () => {
    const html = renderToStaticMarkup(<RouteLoading />)

    expect(html).toContain('role="status"')
    expect(html).toContain('正在加载页面')
  })
})
