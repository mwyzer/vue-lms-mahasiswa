<script setup lang="ts">
/**
 * Forum Thread (Student) — one discussion thread with replies.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student']
})

const route = useRoute()
const coursesStore = useCoursesStore()

const courseId = computed(() => route.params.courseId as string)
const threadId = computed(() => route.params.threadId as string)
const ready = ref(false)

onMounted(async () => {
  await coursesStore.init()
  ready.value = true
})

const enrolled = computed(() => coursesStore.myCourses.some((c) => c.id === courseId.value))
</script>

<template>
  <div>
    <p v-if="!ready" class="forum-guard">Memuat...</p>
    <div v-else-if="!enrolled" class="card forum-guard">
      <p>Anda tidak terdaftar di mata kuliah ini.</p>
      <NuxtLink to="/courses" class="btn btn-primary btn-sm">Kembali ke Mata Kuliah</NuxtLink>
    </div>
    <ForumThreadDetail
      v-else
      :course-id="courseId"
      :thread-id="threadId"
      :base-path="`/courses/${courseId}/forum`"
    />
  </div>
</template>

<style scoped>
.forum-guard {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-neutral-600);
}
</style>
