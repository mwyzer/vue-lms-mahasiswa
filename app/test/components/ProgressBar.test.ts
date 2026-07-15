/**
 * ProgressBar — Unit Tests
 *
 * Tests rendering with various progress values and configurations.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProgressBar from '~/components/common/ProgressBar.vue'

describe('ProgressBar', () => {
  it('renders progress with label and percent', () => {
    const wrapper = mount(ProgressBar, {
      props: {
        value: 60,
        label: 'Progress',
      },
    })
    // Check label text via targeted selector
    const header = wrapper.find('.progress-header')
    expect(header.html()).toContain('Progress')
    expect(header.html()).toContain('60%')
  })

  it('does not show percent when showPercent is false', () => {
    const wrapper = mount(ProgressBar, {
      props: {
        value: 75,
        showPercent: false,
      },
    })
    const header = wrapper.find('.progress-header')
    expect(header.html()).not.toContain('75%')
  })

  it('does not show label when not provided', () => {
    const wrapper = mount(ProgressBar, {
      props: {
        value: 50,
      },
    })
    const fill = wrapper.find('.progress-fill')
    expect(fill.attributes('style')).toContain('width: 50%')
  })

  it('clamps value between 0 and 100', () => {
    const wrapper = mount(ProgressBar, {
      props: {
        value: 150,
      },
    })
    const fill = wrapper.find('.progress-fill')
    expect(fill.attributes('style')).toContain('width: 100%')
  })

  it('handles negative value as 0', () => {
    const wrapper = mount(ProgressBar, {
      props: {
        value: -10,
      },
    })
    const fill = wrapper.find('.progress-fill')
    expect(fill.attributes('style')).toContain('width: 0%')
  })

  it('sets custom height', () => {
    const wrapper = mount(ProgressBar, {
      props: {
        value: 50,
        height: 12,
      },
    })
    const bar = wrapper.find('.progress-bar')
    expect(bar.attributes('style')).toContain('height: 12px')
  })

  it('uses default 8px height when not specified', () => {
    const wrapper = mount(ProgressBar, {
      props: {
        value: 50,
      },
    })
    const bar = wrapper.find('.progress-bar')
    expect(bar.attributes('style')).toContain('height: 8px')
  })

  it('renders fill with correct width percentage', () => {
    const wrapper = mount(ProgressBar, {
      props: {
        value: 42,
      },
    })
    const fill = wrapper.find('.progress-fill')
    expect(fill.attributes('style')).toContain('width: 42%')
  })
})
