/**
 * PageHeader — Unit Tests
 *
 * Tests rendering title, subtitle, and actions slot.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PageHeader from '~/components/common/PageHeader.vue'

describe('PageHeader', () => {
  it('renders title', () => {
    const wrapper = mount(PageHeader, {
      props: { title: 'Dashboard' },
    })
    expect(wrapper.find('h1').text()).toBe('Dashboard')
  })

  it('renders subtitle when provided', () => {
    const wrapper = mount(PageHeader, {
      props: {
        title: 'Mata Kuliah',
        subtitle: 'Daftar mata kuliah yang Anda ikuti.',
      },
    })
    expect(wrapper.text()).toContain('Mata Kuliah')
    expect(wrapper.text()).toContain('Daftar mata kuliah yang Anda ikuti.')
  })

  it('does not render subtitle when not provided', () => {
    const wrapper = mount(PageHeader, {
      props: { title: 'Dashboard' },
    })
    expect(wrapper.find('.text-muted').exists()).toBe(false)
  })

  it('renders actions slot content', () => {
    const wrapper = mount(PageHeader, {
      props: { title: 'Tugas' },
      slots: {
        actions: '<button class="btn btn-primary">+ Buat Tugas</button>',
      },
    })
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.find('button').text()).toBe('+ Buat Tugas')
  })
})
