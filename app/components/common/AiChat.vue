<script setup lang="ts">
/**
 * AiChat — AI Teaching Assistant chat interface.
 *
 * Provides a full chat UI with message history, streaming responses,
 * typing indicator, and input controls.
 */
import { useAiChat, type ChatMessage } from '~/composables/useAiChat'

const {
  messages,
  isProcessing,
  error,
  hasMessages,
  sendMessage,
  cancelResponse,
  clearChat,
} = useAiChat()

const inputText = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

// Auto-scroll to bottom when new messages arrive
watch(
  () => messages.value.length,
  () => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  },
  { deep: true }
)

// Auto-resize textarea
function autoResize() {
  const el = inputRef.value
  if (el) {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }
}

// Send message on Enter (Shift+Enter for newline)
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

function handleSend() {
  const text = inputText.value.trim()
  if (!text || isProcessing.value) return
  inputText.value = ''
  if (inputRef.value) {
    inputRef.value.style.height = 'auto'
  }
  sendMessage(text)
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function getMessageContent(content: string): string {
  // Escape HTML and render markdown-style formatting
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}

const suggestions = [
  'Apa itu variabel dalam pemrograman?',
  'Jelaskan perulangan for di Python',
  'Apa perbedaan SQL dan NoSQL?',
  'Tips mengerjakan tugas kuliah?',
  'Jelaskan OOP dan 4 pilarnya',
  'Apa itu Matematika Diskrit?',
]
</script>

<template>
  <div class="ai-chat">
    <!-- Header -->
    <div class="chat-header">
      <div class="chat-header-info">
        <span class="chat-avatar">🤖</span>
        <div>
          <h3>AI Teaching Assistant</h3>
          <p class="chat-status" :class="{ processing: isProcessing }">
            {{ isProcessing ? 'Mengetik...' : 'Online' }}
          </p>
        </div>
      </div>
      <button
        v-if="hasMessages"
        class="btn-icon"
        title="Hapus percakapan"
        @click="clearChat"
      >
        <span class="icon">🗑️</span>
      </button>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="chat-messages">
      <!-- Empty state -->
      <div v-if="!hasMessages" class="chat-empty">
        <div class="chat-empty-icon">💬</div>
        <h4>Ada yang bisa saya bantu?</h4>
        <p>
          Tanyakan tentang materi perkuliahan, tugas, atau fitur LMS.
          Saya adalah asisten AI yang siap membantu belajarmu!
        </p>
        <div class="suggestion-chips">
          <button
            v-for="(suggestion, idx) in suggestions"
            :key="idx"
            class="chip"
            :disabled="isProcessing"
            @click="inputText = suggestion; handleSend()"
          >
            {{ suggestion }}
          </button>
        </div>
      </div>

      <!-- Messages list -->
      <div v-for="msg in messages" :key="msg.id" class="message-wrapper">
        <div
          class="message"
          :class="[`message-${msg.role}`, { 'message-streaming': msg.role === 'assistant' && isProcessing && msg === messages[messages.length - 1] && msg.content === '' }]"
        >
          <div class="message-avatar">
            {{ msg.role === 'user' ? '👤' : '🤖' }}
          </div>
          <div class="message-content">
            <div class="message-header">
              <strong>{{ msg.role === 'user' ? 'Kamu' : 'AI Assistant' }}</strong>
              <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
            </div>
            <div
              v-if="msg.content"
              class="message-text"
              v-html="getMessageContent(msg.content)"
            />
            <div
              v-else-if="msg.role === 'assistant' && isProcessing && msg === messages[messages.length - 1]"
              class="typing-indicator"
            >
              <span class="dot" />
              <span class="dot" />
              <span class="dot" />
            </div>
          </div>
        </div>
      </div>

      <!-- Error alert -->
      <div v-if="error" class="chat-error">
        <span>⚠️</span>
        <span>{{ error }}</span>
      </div>
    </div>

    <!-- Input area -->
    <div class="chat-input-area">
      <div class="chat-input-wrapper">
        <textarea
          ref="inputRef"
          v-model="inputText"
          class="chat-input"
          placeholder="Tanya sesuatu tentang materi kuliah..."
          rows="1"
          :disabled="isProcessing"
          @keydown="onKeydown"
          @input="autoResize"
        />
        <div class="chat-input-actions">
          <button
            v-if="isProcessing"
            class="btn btn-stop"
            title="Hentikan"
            @click="cancelResponse"
          >
            ⏹️ Hentikan
          </button>
          <button
            v-else
            class="btn btn-send"
            :disabled="!inputText.trim()"
            title="Kirim pesan"
            @click="handleSend"
          >
            Kirim ➤
          </button>
        </div>
      </div>
      <p class="chat-footer-note">
        AI Assistant menggunakan mode demo. Jawaban bersifat simulasi.
        <span class="badge-demo">DEMO</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.ai-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-lg);
  background: white;
  overflow: hidden;
}

/* ── Header ── */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-neutral-200);
  background: var(--color-neutral-50);
}

.chat-header-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.chat-avatar {
  font-size: 1.75rem;
  line-height: 1;
}

.chat-header-info h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-neutral-800);
}

.chat-status {
  font-size: 0.8rem;
  color: var(--color-success);
  transition: color 0.3s;
}

.chat-status.processing {
  color: var(--color-warning);
}

.btn-icon {
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  padding: 0.375rem;
  cursor: pointer;
  font-size: 1.1rem;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: var(--color-neutral-200);
}

/* ── Messages ── */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 320px;
}

/* Empty state */
.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem 1rem;
  flex: 1;
}

.chat-empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.chat-empty h4 {
  font-size: 1.15rem;
  color: var(--color-neutral-700);
  margin-bottom: 0.5rem;
}

.chat-empty p {
  color: var(--color-neutral-500);
  font-size: 0.9rem;
  max-width: 400px;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

/* Suggestion chips */
.suggestion-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.chip {
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-200);
  border-radius: 100px;
  padding: 0.4rem 0.85rem;
  font-size: 0.8rem;
  color: var(--color-primary-700);
  cursor: pointer;
  transition: all 0.2s;
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip:hover:not(:disabled) {
  background: var(--color-primary-100);
  border-color: var(--color-primary-400);
}

.chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Message bubbles */
.message-wrapper {
  display: flex;
  flex-direction: column;
}

.message {
  display: flex;
  gap: 0.75rem;
  max-width: 85%;
}

.message-user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-assistant {
  align-self: flex-start;
}

.message-avatar {
  font-size: 1.5rem;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.message-content {
  background: var(--color-neutral-100);
  border-radius: var(--radius-lg);
  padding: 0.65rem 1rem;
  min-width: 0;
}

.message-user .message-content {
  background: var(--color-primary-500);
  color: white;
  border-bottom-right-radius: var(--radius-sm);
}

.message-assistant .message-content {
  background: var(--color-neutral-100);
  border-bottom-left-radius: var(--radius-sm);
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
}

.message-user .message-header strong {
  color: rgba(255, 255, 255, 0.9);
}

.message-time {
  font-size: 0.7rem;
  opacity: 0.7;
}

.message-text {
  font-size: 0.9rem;
  line-height: 1.6;
  word-wrap: break-word;
}

.message-text :deep(pre) {
  background: var(--color-neutral-800);
  color: #e2e8f0;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  overflow-x: auto;
  font-size: 0.8rem;
  font-family: var(--font-mono);
  margin: 0.5rem 0;
}

.message-text :deep(code) {
  background: rgba(0, 0, 0, 0.08);
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm);
  font-size: 0.85em;
  font-family: var(--font-mono);
}

.message-user .message-text :deep(code) {
  background: rgba(255, 255, 255, 0.2);
}

.message-text :deep(br) {
  content: '';
  display: block;
  margin: 0.25rem 0;
}

/* Typing indicator */
.typing-indicator {
  display: flex;
  gap: 0.35rem;
  padding: 0.5rem 0;
}

.dot {
  width: 8px;
  height: 8px;
  background: var(--color-neutral-400);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }
.dot:nth-child(3) { animation-delay: 0s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* Error */
.chat-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius-md);
  color: var(--color-error);
  font-size: 0.85rem;
}

/* ── Input area ── */
.chat-input-area {
  border-top: 1px solid var(--color-neutral-200);
  padding: 0.85rem 1.25rem;
  background: var(--color-neutral-50);
}

.chat-input-wrapper {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-lg);
  padding: 0.65rem 1rem;
  font-size: 0.9rem;
  font-family: var(--font-sans);
  resize: none;
  outline: none;
  transition: border-color 0.2s;
  max-height: 160px;
  line-height: 1.5;
  background: white;
}

.chat-input:focus {
  border-color: var(--color-primary-400);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.chat-input:disabled {
  background: var(--color-neutral-100);
  cursor: not-allowed;
}

.chat-input::placeholder {
  color: var(--color-neutral-400);
}

.chat-input-actions {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;
}

.btn {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: var(--radius-lg);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-send {
  background: var(--color-primary-500);
  color: white;
}

.btn-send:hover:not(:disabled) {
  background: var(--color-primary-600);
}

.btn-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-stop {
  background: var(--color-error);
  color: white;
}

.btn-stop:hover {
  background: #dc2626;
}

.chat-footer-note {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-neutral-400);
}

.badge-demo {
  display: inline-block;
  background: var(--color-warning);
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
</style>
