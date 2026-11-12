<script setup lang="ts">
/** Mahasiswa berisiko — admin (lintas kampus). */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin'],
})
useHead({ title: 'Mahasiswa Berisiko — Admin LMS' })
</script>

<template>
  <AtRiskDashboard mode="admin" />
</template>
