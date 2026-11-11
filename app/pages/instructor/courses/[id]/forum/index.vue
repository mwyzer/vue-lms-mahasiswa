<script setup lang="ts">
/**
 * Course Forum (Instructor) — discussion threads with moderation.
 */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor']
})

const route = useRoute()
const courseId = computed(() => route.params.id as string)
</script>

<template>
  <ForumThreadList
    :course-id="courseId"
    :base-path="`/instructor/courses/${courseId}/forum`"
    :back-to="`/instructor/courses/${courseId}`"
  />
</template>
