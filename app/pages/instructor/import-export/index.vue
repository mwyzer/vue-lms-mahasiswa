<script setup lang="ts">
/** Impor mahasiswa & ekspor nilai/presensi/daftar — instruktur. */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor'],
})
useHead({ title: 'Impor / Ekspor — LMS Mahasiswa' })
</script>

<template>
  <ImportExportPanel mode="instructor" />
</template>
