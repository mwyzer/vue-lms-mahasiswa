<script setup lang="ts">
/**
 * Course Forum (Student) — discussion threads for an enrolled course.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student']
})

const route = useRoute()
const coursesStore = useCoursesStore()

const courseId = computed(() => route.params.courseId as string)
const ready = ref(false)

onMounted(async () => {
  await coursesStore.init()
  ready.value = true
})

/** Students may only open the forum of a course they are enrolled in. */
const enrolled = computed(() => coursesStore.myCourses.some((c) => c.id === courseId.value))
</script>

<template>
  <div>
    <p v-if="!ready" class="forum-guard">Memuat...</p>
    <div v-else-if="!enrolled" class="card forum-guard">
      <p>Anda tidak terdaftar di mata kuliah ini.</p>
      <NuxtLink to="/courses" class="btn btn-primary btn-sm">Kembali ke Mata Kuliah</NuxtLink>
    </div>
    <ForumThreadList
      v-else
      :course-id="courseId"
      :base-path="`/courses/${courseId}/forum`"
      :back-to="`/courses/${courseId}`"
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
