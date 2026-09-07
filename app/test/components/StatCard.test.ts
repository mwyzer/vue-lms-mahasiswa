/**
 * StatCard — Unit Tests
 *
 * Tests rendering with default and custom props.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatCard from '~/components/common/StatCard.vue'

describe('StatCard', () => {
  it('renders icon, value, and label', () => {
    const wrapper = mount(StatCard, {
      props: {
        icon: '📖',
        value: '5',
        label: 'Mata Kuliah Aktif',
      },
    })
    expect(wrapper.text()).toContain('📖')
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('Mata Kuliah Aktif')
  })

  it('applies custom background and icon colors', () => {
    const wrapper = mount(StatCard, {
      props: {
        icon: '✅',
        value: '3',
        label: 'Selesai',
        bgColor: '#dcfce7',
        iconColor: '#15803d',
      },
    })
    const card = wrapper.find('.stat-card')
    expect(card.attributes('style')).toContain('--stat-bg: #dcfce7')
    expect(card.attributes('style')).toContain('--stat-fg: #15803d')
  })

  it('uses default colors when not specified', () => {
    const wrapper = mount(StatCard, {
      props: {
        icon: '📊',
        value: '75%',
        label: 'Progress',
      },
    })
    const card = wrapper.find('.stat-card')
    expect(card.attributes('style')).toContain('--stat-bg: var(--color-accent-soft)')
    expect(card.attributes('style')).toContain('--stat-fg: var(--color-accent-deep)')
  })

  it('renders numeric value correctly', () => {
    const wrapper = mount(StatCard, {
      props: {
        icon: '📊',
        value: 100,
        label: 'Persen',
      },
    })
    expect(wrapper.text()).toContain('100')
  })

  it('has accessible structure', () => {
    const wrapper = mount(StatCard, {
      props: {
        icon: '📖',
        value: '5',
        label: 'Mata Kuliah Aktif',
      },
    })
    expect(wrapper.find('.stat-value').exists()).toBe(true)
    expect(wrapper.find('.stat-label').exists()).toBe(true)
    // The icon is decorative emoji, text conveys meaning
    expect(wrapper.find('.stat-card').exists()).toBe(true)
  })
})
