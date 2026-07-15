/**
 * SessionBadge — Unit Tests
 *
 * Tests rendering for morning and evening sessions.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SessionBadge from '~/components/common/SessionBadge.vue'

describe('SessionBadge', () => {
  it('shows "Pagi" for morning session', () => {
    const wrapper = mount(SessionBadge, {
      props: { session: 'morning' },
    })
    expect(wrapper.text()).toBe('Pagi')
    expect(wrapper.classes()).toContain('badge-primary')
  })

  it('shows "Malam" for evening session', () => {
    const wrapper = mount(SessionBadge, {
      props: { session: 'evening' },
    })
    expect(wrapper.text()).toBe('Malam')
    expect(wrapper.classes()).toContain('badge-warning')
  })

  it('has badge base class', () => {
    const wrapper = mount(SessionBadge, {
      props: { session: 'morning' },
    })
    expect(wrapper.classes()).toContain('badge')
  })
})
