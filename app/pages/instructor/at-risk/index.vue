<script setup lang="ts">
/** Mahasiswa berisiko — instruktur (hanya mata kuliah yang diampu). */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor'],
})
useHead({ title: 'Mahasiswa Berisiko — LMS Mahasiswa' })
</script>

<template>
  <AtRiskDashboard mode="instructor" />
</template>
