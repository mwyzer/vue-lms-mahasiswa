<script setup lang="ts">
/** Impor mahasiswa & ekspor nilai/presensi/daftar — admin (lintas kampus). */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin'],
})
useHead({ title: 'Impor / Ekspor — Admin LMS' })
</script>

<template>
  <ImportExportPanel mode="admin" />
</template>
