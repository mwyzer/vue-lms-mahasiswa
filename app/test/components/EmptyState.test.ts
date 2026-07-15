/**
 * EmptyState — Unit Tests
 *
 * Tests rendering with default/custom messages and slot content.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyState from '~/components/common/EmptyState.vue'

describe('EmptyState', () => {
  it('renders default message when not provided', () => {
    const wrapper = mount(EmptyState)
    expect(wrapper.text()).toContain('Tidak ada data.')
  })

  it('renders custom message', () => {
    const wrapper = mount(EmptyState, {
      props: {
        message: 'Belum ada mata kuliah yang didaftarkan.',
      },
    })
    expect(wrapper.text()).toContain('Belum ada mata kuliah yang didaftarkan.')
    expect(wrapper.text()).not.toContain('Tidak ada data.')
  })

  it('renders icon when provided', () => {
    const wrapper = mount(EmptyState, {
      props: {
        icon: '📚',
        message: 'No courses yet.',
      },
    })
    expect(wrapper.text()).toContain('📚')
    expect(wrapper.find('.empty-icon').exists()).toBe(true)
  })

  it('does not show icon when not provided', () => {
    const wrapper = mount(EmptyState, {
      props: {
        message: 'Kosong.',
      },
    })
    expect(wrapper.find('.empty-icon').exists()).toBe(false)
  })

  it('renders slot content', () => {
    const wrapper = mount(EmptyState, {
      props: {
        message: 'Tidak ada tugas.',
      },
      slots: {
        default: '<button class="btn btn-primary">Buat Tugas</button>',
      },
    })
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.find('button').text()).toBe('Buat Tugas')
  })
})
