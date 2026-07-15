/**
 * AiChat — Unit Tests
 *
 * Tests rendering, state transitions, and user interactions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AiChat from '~/components/common/AiChat.vue'
import { createPinia, setActivePinia } from 'pinia'

// ── Mock fetch ──
globalThis.fetch = vi.fn()

// ── Mock useNotification ──
vi.mock('~/composables/useNotification', () => ({
  useNotification: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))

describe('AiChat', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders the chat interface', () => {
    const wrapper = mount(AiChat)
    expect(wrapper.find('.ai-chat').exists()).toBe(true)
    expect(wrapper.text()).toContain('AI Teaching Assistant')
  })

  it('shows empty state with suggestion chips', () => {
    const wrapper = mount(AiChat)
    expect(wrapper.text()).toContain('Ada yang bisa saya bantu?')
    const chips = wrapper.findAll('.chip')
    expect(chips.length).toBeGreaterThan(0)
    expect(chips[0].text()).toBeTruthy()
  })

  it('has input field and send button', () => {
    const wrapper = mount(AiChat)
    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect(textarea.attributes('placeholder')).toContain('Tanya sesuatu')

    const sendBtn = wrapper.find('.btn-send')
    expect(sendBtn.exists()).toBe(true)
  })

  it('disables send button when input is empty', () => {
    const wrapper = mount(AiChat)
    const sendBtn = wrapper.find('.btn-send')
    expect(sendBtn.attributes('disabled')).toBeDefined()
  })

  it('enables send button when input has text', async () => {
    const wrapper = mount(AiChat)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Apa itu variabel?')
    const sendBtn = wrapper.find('.btn-send')
    expect(sendBtn.attributes('disabled')).toBeUndefined()
  })

  it('sends message and shows user message', async () => {
    // Mock streaming response
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"word":"Halo"}\n\ndata: {"word":" ini"}\n\n'))
        controller.close()
      },
    })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockStream,
      headers: new Headers(),
    })

    const wrapper = mount(AiChat)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Halo AI!')

    // Wait for reactivity
    await wrapper.vm.$nextTick()
    const sendBtn = wrapper.find('.btn-send')
    await sendBtn.trigger('click')

    // Wait for async operations
    await flushPromises()
    await wrapper.vm.$nextTick()

    // User message should appear
    expect(wrapper.text()).toContain('Halo AI!')
  })

  it('clears chat when clear button is clicked', async () => {
    // Mock a fetch that returns a simple response
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply: 'Test response' }),
    })

    const wrapper = mount(AiChat)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Test message')
    await wrapper.vm.$nextTick()

    const sendBtn = wrapper.find('.btn-send')
    await sendBtn.trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    // Message should exist
    expect(wrapper.text()).toContain('Test message')

    // Click clear
    const clearBtn = wrapper.find('.btn-icon')
    if (clearBtn.exists()) {
      await clearBtn.trigger('click')
      await wrapper.vm.$nextTick()
      // Should go back to empty state
      expect(wrapper.text()).toContain('Ada yang bisa saya bantu?')
    }
  })

  it('shows processing state when sending', async () => {
    // Mock a fetch that never resolves (keeps processing)
    const abortController = new AbortController()
    globalThis.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          // Hold until aborted
          abortController.signal.addEventListener('abort', () => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ reply: '' }),
            })
          })
        })
    )

    const wrapper = mount(AiChat)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Processing test')
    await wrapper.vm.$nextTick()

    const sendBtn = wrapper.find('.btn-send')
    await sendBtn.trigger('click')
    await wrapper.vm.$nextTick()

    // Should show stop button
    expect(wrapper.find('.btn-stop').exists()).toBe(true)
  })

  it('renders demo badge in footer', () => {
    const wrapper = mount(AiChat)
    expect(wrapper.find('.badge-demo').exists()).toBe(true)
    expect(wrapper.find('.badge-demo').text()).toBe('DEMO')
  })

  it('shows online status by default', () => {
    const wrapper = mount(AiChat)
    expect(wrapper.text()).toContain('Online')
  })
})
