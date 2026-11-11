<script setup lang="ts">
/**
 * ForumThreadDetail — one discussion thread with its replies and a reply form.
 * Shared by the student and instructor forum pages. Post bodies are rendered
 * as plain text (never v-html).
 */
import { useForumStore, POST_BODY_MAX } from '~/stores/forum'
import { useCoursesStore } from '~/stores/courses'
import { useAuthStore } from '~/stores/auth'

const props = defineProps<{
  courseId: string
  threadId: string
  /** Route of the thread list, e.g. `/courses/c1/forum`. */
  basePath: string
}>()

const forum = useForumStore()
const coursesStore = useCoursesStore()
const auth = useAuthStore()
const notification = useNotification()

const ready = ref(false)
const replyText = ref('')
const sending = ref(false)
const confirmDeleteThread = ref(false)

onMounted(async () => {
  await auth.init()
  await coursesStore.init()
  await forum.init()
  ready.value = true
})

const thread = computed(() => {
  const t = forum.threadById(props.threadId)
  return t && t.course_id === props.courseId ? t : null
})
const replies = computed(() => forum.repliesForThread(props.threadId))
const canModerate = computed(() => forum.canModerate(props.courseId))
const isAuthor = computed(() => !!thread.value && thread.value.author_id === auth.user?.id)
const canReply = computed(() => !!thread.value && (!thread.value.is_locked || canModerate.value))

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function roleLabel(role: string | null): string {
  if (role === 'instructor') return 'Instruktur'
  if (role === 'admin') return 'Admin'
  return ''
}

async function sendReply() {
  sending.value = true
  const ok = await forum.addReply(props.threadId, replyText.value)
  sending.value = false
  if (!ok) {
    notification.error(forum.error || 'Gagal mengirim balasan.')
    return
  }
  replyText.value = ''
}

async function removeThread() {
  const ok = await forum.deleteThread(props.threadId)
  if (!ok) {
    notification.error(forum.error || 'Gagal menghapus diskusi.')
    return
  }
  notification.success('Diskusi dihapus.')
  await navigateTo(props.basePath)
}

async function removeReply(replyId: string) {
  const ok = await forum.deleteReply(replyId)
  if (!ok) notification.error(forum.error || 'Gagal menghapus balasan.')
}

async function toggleAnswer(replyId: string, current: boolean) {
  const ok = await forum.setAnswer(replyId, !current)
  if (!ok) notification.error(forum.error || 'Gagal menandai jawaban.')
}
</script>

<template>
  <div class="thread-page">
    <NuxtLink :to="basePath" class="btn btn-ghost btn-sm back-link">← Kembali ke Forum</NuxtLink>

    <p v-if="!ready" class="muted">Memuat diskusi...</p>

    <div v-else-if="!thread" class="card not-found">
      <p>Diskusi tidak ditemukan atau sudah dihapus.</p>
      <NuxtLink :to="basePath" class="btn btn-primary btn-sm">Lihat Semua Diskusi</NuxtLink>
    </div>

    <template v-else>
      <!-- Thread -->
      <article class="card thread">
        <div class="badges">
          <span v-if="thread.is_pinned" class="badge badge-primary">📌 Disematkan</span>
          <span v-if="thread.is_locked" class="badge badge-neutral">🔒 Dikunci</span>
          <span v-if="thread.has_answer" class="badge badge-success">✓ Terjawab</span>
        </div>
        <h1>{{ thread.judul }}</h1>
        <p class="meta">
          {{ thread.author_name }}
          <span v-if="roleLabel(thread.author_role)" class="role-tag">{{ roleLabel(thread.author_role) }}</span>
          · {{ formatDate(thread.created_at) }}
        </p>
        <p class="body">{{ thread.konten }}</p>

        <div v-if="canModerate || isAuthor" class="actions">
          <template v-if="canModerate">
            <button class="btn btn-ghost btn-sm" @click="forum.togglePin(thread.id)">
              {{ thread.is_pinned ? 'Lepas Sematan' : '📌 Sematkan' }}
            </button>
            <button class="btn btn-ghost btn-sm" @click="forum.toggleLock(thread.id)">
              {{ thread.is_locked ? '🔓 Buka Kunci' : '🔒 Kunci' }}
            </button>
          </template>
          <template v-if="!confirmDeleteThread">
            <button class="btn btn-ghost btn-sm danger-text" @click="confirmDeleteThread = true">Hapus</button>
          </template>
          <template v-else>
            <span class="muted">Hapus diskusi beserta semua balasannya?</span>
            <button class="btn btn-danger btn-sm" @click="removeThread">Ya, Hapus</button>
            <button class="btn btn-ghost btn-sm" @click="confirmDeleteThread = false">Batal</button>
          </template>
        </div>
      </article>

      <!-- Replies -->
      <h2 class="replies-title">{{ replies.length }} Balasan</h2>

      <p v-if="replies.length === 0" class="muted">Belum ada balasan. Jadilah yang pertama membalas.</p>

      <ul v-else class="reply-list">
        <li
          v-for="r in replies"
          :key="r.id"
          class="card reply"
          :class="{ answer: r.is_answer }"
        >
          <div class="reply-head">
            <p class="meta">
              {{ r.author_name }}
              <span v-if="roleLabel(r.author_role)" class="role-tag">{{ roleLabel(r.author_role) }}</span>
              · {{ formatDate(r.created_at) }}
            </p>
            <span v-if="r.is_answer" class="badge badge-success">✓ Jawaban</span>
          </div>
          <p class="body">{{ r.konten }}</p>
          <div v-if="canModerate || r.author_id === auth.user?.id" class="actions">
            <button v-if="canModerate" class="btn btn-ghost btn-sm" @click="toggleAnswer(r.id, r.is_answer)">
              {{ r.is_answer ? 'Batalkan Tanda Jawaban' : '✓ Tandai sebagai Jawaban' }}
            </button>
            <button class="btn btn-ghost btn-sm danger-text" @click="removeReply(r.id)">Hapus</button>
          </div>
        </li>
      </ul>

      <!-- Reply form -->
      <form v-if="canReply" class="card reply-form" @submit.prevent="sendReply">
        <label class="form-label" for="forum-reply">Balasan Anda</label>
        <textarea
          id="forum-reply"
          v-model="replyText"
          class="form-textarea"
          rows="4"
          :maxlength="POST_BODY_MAX"
          placeholder="Tulis balasan..."
        />
        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-sm" :disabled="sending || !replyText.trim()">
            {{ sending ? 'Mengirim...' : 'Kirim Balasan' }}
          </button>
        </div>
      </form>
      <p v-else class="card locked-note">🔒 Diskusi ini dikunci oleh instruktur. Balasan baru tidak dapat ditambahkan.</p>
    </template>
  </div>
</template>

<style scoped>
.thread-page {
  max-width: 56rem;
}

.back-link {
  margin-bottom: 0.75rem;
}

.muted {
  color: var(--color-neutral-500);
  font-size: 0.875rem;
}

.not-found {
  text-align: center;
  padding: 2rem 1rem;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.badges:not(:empty) {
  margin-bottom: 0.5rem;
}

.thread h1 {
  margin: 0;
  font-size: 1.375rem;
  overflow-wrap: anywhere;
}

.meta {
  margin: 0.375rem 0 0;
  font-size: 0.8125rem;
  color: var(--color-neutral-500);
}

.role-tag {
  margin-left: 0.25rem;
  padding: 0.0625rem 0.375rem;
  border-radius: 9999px;
  background-color: var(--color-primary-100);
  color: var(--color-primary-700);
  font-weight: 600;
  font-size: 0.75rem;
}

.body {
  margin: 0.75rem 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--color-neutral-800);
  line-height: 1.6;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-neutral-100);
}

.danger-text {
  color: var(--color-error);
}

.replies-title {
  margin: 1.5rem 0 0.75rem;
  font-size: 1.0625rem;
}

.reply-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.reply.answer {
  border-left: 4px solid var(--color-success);
}

.reply-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.reply-head .meta {
  margin: 0;
}

.reply-form {
  margin-top: 1.25rem;
}

.locked-note {
  margin-top: 1.25rem;
  color: var(--color-neutral-600);
  font-size: 0.875rem;
}
</style>
