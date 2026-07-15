<script setup lang="ts">
/**
 * AI Chat page — Full-page AI Teaching Assistant interface.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth'],
})

const { user } = useAuthStore()
</script>

<template>
  <div class="ai-page">
    <CommonPageHeader
      title="AI Teaching Assistant"
      subtitle="Tanyakan tentang materi kuliah, tugas, atau fitur LMS"
    />

    <div class="ai-chat-container">
      <CommonAiChat />
    </div>
  </div>
</template>

<style scoped>
.ai-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ai-chat-container {
  flex: 1;
  min-height: 500px;
  display: flex;
  flex-direction: column;
}
</style>
