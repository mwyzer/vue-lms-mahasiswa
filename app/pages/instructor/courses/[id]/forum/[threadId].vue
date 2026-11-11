<script setup lang="ts">
/**
 * Forum Thread (Instructor) — reply, mark answers, pin, lock, delete.
 */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor']
})

const route = useRoute()
const courseId = computed(() => route.params.id as string)
const threadId = computed(() => route.params.threadId as string)
</script>

<template>
  <ForumThreadDetail
    :course-id="courseId"
    :thread-id="threadId"
    :base-path="`/instructor/courses/${courseId}/forum`"
  />
</template>
