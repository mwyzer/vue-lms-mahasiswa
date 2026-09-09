<script setup lang="ts">
/**
 * Admin Campuses — Multi-campus management.
 * Admin can create/edit/delete campus entities, view per-campus headcounts,
 * and set the active campus scope used to filter admin dashboards.
 */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

const campusStore = useCampusStore()
const auth = useAuthStore()
const notification = useNotification()

const campuses = computed(() => campusStore.allCampuses)
const counts = computed(() => campusStore.campusCounts)

onMounted(() => {
  auth.init()
  campusStore.init()
})

function countFor(campusId: string, key: 'students' | 'instructors' | 'courses'): number {
  const row = counts.value.find((c) => c.campusId === campusId)
  return row ? row[key] : 0
}

function campusInitial(campusId: string): string {
  const campus = campuses.value.find((c) => c.id === campusId)
  return campus?.nama?.charAt(0) || '?'
}

function campusName(campusId: string): string {
  const campus = campuses.value.find((c) => c.id === campusId)
  return campus?.nama || campusId
}

// ── Form state ──
const showForm = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const formKode = ref('')
const formNama = ref('')
const formAlamat = ref('')

function openAddForm() {
  editingId.value = null
  formKode.value = ''
  formNama.value = ''
  formAlamat.value = ''
  showForm.value = true
}

function openEditForm(c: any) {
  editingId.value = c.id
  formKode.value = c.kode
  formNama.value = c.nama
  formAlamat.value = c.alamat || ''
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingId.value = null
  campusStore.error = null
}

async function saveCampus() {
  if (!formNama.value.trim() || !formKode.value.trim()) {
    notification.warning('Kode dan nama kampus harus diisi.')
    return
  }
  saving.value = true
  try {
    const ok = editingId.value
      ? await campusStore.updateCampus(editingId.value, { kode: formKode.value.trim(), nama: formNama.value.trim(), alamat: formAlamat.value.trim() })
      : await campusStore.addCampus({ kode: formKode.value.trim(), nama: formNama.value.trim(), alamat: formAlamat.value.trim() })
    if (!ok) {
      notification.error(campusStore.error || 'Gagal menyimpan kampus.')
      return
    }
    notification.success(editingId.value ? 'Kampus berhasil diperbarui!' : 'Kampus berhasil ditambahkan!')
    showForm.value = false
    editingId.value = null
  } catch {
    notification.error('Terjadi kesalahan saat menyimpan kampus.')
  } finally {
    saving.value = false
  }
}

async function confirmDelete(c: any) {
  if (!confirm(`Hapus kampus "${c.nama}"? Data yang terkait tidak akan terhapus.`)) return
  const ok = await campusStore.deleteCampus(c.id)
  if (ok) {
    notification.success('Kampus berhasil dihapus.')
  } else {
    notification.error(campusStore.error || 'Gagal menghapus kampus.')
  }
}

function setActiveScope(campusId: string | null) {
  campusStore.selectCampus(campusId)
  notification.info(campusId ? `Cakupan diubah ke ${campusName(campusId)}` : 'Cakupan direset ke semua kampus')
}
</script>

<template>
  <div class="campuses-page">
    <div class="page-header">
      <div>
        <h1>Kampus</h1>
        <p class="text-muted">Kelola cabang kampus dan lihat sebaran data per kampus.</p>
      </div>
      <button v-if="!showForm" class="btn btn-primary btn-sm" @click="openAddForm">
        + Tambah Kampus
      </button>
    </div>

    <!-- Active scope -->
    <div class="card scope-card">
      <div class="scope-info">
        <span class="scope-label">Cakupan aktif (filter dashboard admin):</span>
        <span v-if="campusStore.currentCampus" class="badge badge-primary">
          {{ campusStore.currentCampus.nama }}
        </span>
        <span v-else class="badge badge-neutral">Semua kampus</span>
      </div>
      <div class="scope-actions">
        <button
          v-for="c in campuses"
          :key="c.id"
          class="btn btn-ghost btn-sm"
          :class="{ 'btn-active': campusStore.currentCampusId === c.id }"
          @click="setActiveScope(c.id)"
        >
          {{ c.nama }}
        </button>
        <button
          v-if="campusStore.currentCampusId"
          class="btn btn-ghost btn-sm"
          @click="setActiveScope(null)"
        >
          Reset
        </button>
      </div>
    </div>

    <!-- Add/Edit form -->
    <div v-if="showForm" class="card form-card">
      <h3>{{ editingId ? 'Edit Kampus' : 'Tambah Kampus Baru' }}</h3>
      <div class="form-group">
        <label class="form-label">Kode Kampus</label>
        <input v-model="formKode" type="text" class="form-input" placeholder="Contoh: KPU" />
      </div>
      <div class="form-group">
        <label class="form-label">Nama Kampus</label>
        <input v-model="formNama" type="text" class="form-input" placeholder="Contoh: Kampus Utama" />
      </div>
      <div class="form-group">
        <label class="form-label">Alamat</label>
        <input v-model="formAlamat" type="text" class="form-input" placeholder="Alamat kampus (opsional)" />
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost btn-sm" @click="cancelForm">Batal</button>
        <button
          class="btn btn-primary btn-sm"
          :disabled="saving || !formKode.trim() || !formNama.trim()"
          @click="saveCampus"
        >
          {{ saving ? 'Menyimpan...' : 'Simpan' }}
        </button>
      </div>
    </div>

    <div v-if="campuses.length === 0" class="empty-state card">
      <p>Belum ada kampus terdaftar.</p>
    </div>

    <div v-else class="campus-grid">
      <div
        v-for="c in campuses"
        :key="c.id"
        class="card campus-card"
        :class="{ 'campus-active': campusStore.currentCampusId === c.id }"
      >
        <div class="campus-avatar">{{ campusInitial(c.id) }}</div>
        <div class="campus-info">
          <div class="campus-name-row">
            <span class="campus-name">{{ c.nama }}</span>
            <span class="campus-kode">{{ c.kode }}</span>
          </div>
          <span class="campus-alamat">{{ c.alamat || '—' }}</span>
          <div class="campus-stats">
            <span class="campus-stat" title="Mahasiswa">👥 {{ countFor(c.id, 'students') }}</span>
            <span class="campus-stat" title="Instruktur">👨‍🏫 {{ countFor(c.id, 'instructors') }}</span>
            <span class="campus-stat" title="Mata Kuliah">📖 {{ countFor(c.id, 'courses') }}</span>
          </div>
        </div>
        <div class="campus-actions">
          <button class="btn btn-ghost btn-sm" @click="setActiveScope(c.id)">Lihat</button>
          <button class="btn btn-ghost btn-sm" @click="openEditForm(c)">Edit</button>
          <button class="btn btn-danger btn-sm" @click="confirmDelete(c)">Hapus</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.campuses-page {
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}

.text-muted {
  color: var(--text-muted, #94a3b8);
  font-size: 0.875rem;
  margin: 0;
}

.scope-card {
  padding: 1rem 1.25rem;
  margin-bottom: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.scope-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.scope-label {
  color: var(--text-muted, #94a3b8);
}

.scope-actions {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.btn-active {
  background: var(--color-primary-bg, #eff6ff);
  color: var(--color-primary, #2563eb);
  border-color: var(--color-primary, #2563eb);
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-primary {
  background-color: #dbeafe;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}

.badge-neutral {
  background-color: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-700);
  margin-bottom: 0.375rem;
}

.form-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-md);
  background: white;
  color: var(--color-neutral-800);
  font-size: 0.875rem;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-neutral-200);
}

.campus-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1rem;
}

.campus-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  transition: all 0.2s;
  border-width: 2px;
}

.campus-active {
  border-color: var(--color-primary, #2563eb);
}

.campus-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: #dbeafe;
  color: #1d4ed8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.campus-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.campus-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.campus-name {
  font-size: 0.9375rem;
  font-weight: 600;
}

.campus-kode {
  font-size: 0.6875rem;
  font-weight: 700;
  background: #eef2ff;
  color: #4338ca;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

.campus-alamat {
  font-size: 0.8125rem;
  color: var(--text-muted, #94a3b8);
  margin-top: 0.125rem;
}

.campus-stats {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-muted, #94a3b8);
}

.campus-actions {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--text-muted, #94a3b8);
}

@media (max-width: 768px) {
  .scope-card {
    flex-direction: column;
    align-items: flex-start;
  }
  .campus-grid {
    grid-template-columns: 1fr;
  }
}
</style>