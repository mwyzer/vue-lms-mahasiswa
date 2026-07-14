<script setup lang="ts">
/**
 * Landing Page — Public entry point for LMS Mahasiswa.
 * Shows app overview, features, and a CTA to login.
 */
definePageMeta({
  layout: 'default'
})

const features = [
  { icon: '📖', title: 'Mata Kuliah Terstruktur', desc: 'Akses materi perkuliahan dari Level 1 hingga 4, dengan jadwal pagi dan malam.' },
  { icon: '📝', title: 'Tugas & Penilaian', desc: 'Kumpulkan tugas, lihat nilai, dan dapatkan feedback langsung dari instruktur.' },
  { icon: '📊', title: 'Pantau Progress', desc: 'Lihat persentase penyelesaian materi dan lacak perkembangan belajar Anda.' },
  { icon: '👨‍🏫', title: '3 Instruktur Ahli', desc: 'Dibimbing oleh Dr. Andi Wijaya, Dr. Dewi Lestari, dan Prof. Budi Hartono.' },
  { icon: '🌙', title: 'Fleksibel Pagi & Malam', desc: 'Pilih sesi yang sesuai dengan jadwal Anda — pagi atau malam hari.' },
  { icon: '🔒', title: 'Aman & Pribadi', desc: 'Data Anda aman dengan sistem login berbasis NPM dan profil terproteksi.' },
]

const steps = [
  { step: '1', icon: '👤', title: 'Pilih Peran', desc: 'Masuk sebagai Mahasiswa atau Instruktur.' },
  { step: '2', icon: '📋', title: 'Pilih Identitas', desc: 'Pilih nama dari daftar kelas Anda.' },
  { step: '3', icon: '🚀', title: 'Mulai Belajar', desc: 'Akses mata kuliah, materi, dan tugas.' },
]
</script>

<template>
  <div>
    <!-- Hero Section -->
    <section class="hero">
      <div class="container">
        <div class="hero-content">
          <div class="hero-badge">🎓 Learning Management System</div>
          <h1 class="hero-title">
            LMS <span class="text-primary">Mahasiswa</span>
          </h1>
          <p class="hero-desc">
            Platform pembelajaran terpadu untuk mahasiswa. Akses materi kuliah,
            kumpulkan tugas, dan pantau progress belajar Anda dalam satu tempat.
          </p>
          <div class="hero-actions">
            <NuxtLink to="/login" class="btn btn-primary btn-lg">
              Mulai Belajar →
            </NuxtLink>
          </div>
          <div class="hero-stats">
            <div class="stat">
              <span class="stat-value">4</span>
              <span class="stat-label">Level Kelas</span>
            </div>
            <div class="stat">
              <span class="stat-value">13</span>
              <span class="stat-label">Mata Kuliah</span>
            </div>
            <div class="stat">
              <span class="stat-value">3</span>
              <span class="stat-label">Instruktur</span>
            </div>
            <div class="stat">
              <span class="stat-value">15</span>
              <span class="stat-label">Mahasiswa</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features">
      <div class="container">
        <h2 class="section-title">Kenapa LMS Mahasiswa?</h2>
        <p class="section-desc">
          Platform yang dirancang khusus untuk mendukung perkuliahan yang terstruktur dan efisien.
        </p>
        <div class="features-grid">
          <div v-for="f in features" :key="f.title" class="feature-card card">
            <div class="feature-icon">{{ f.icon }}</div>
            <h3 class="feature-title">{{ f.title }}</h3>
            <p class="feature-desc">{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="how-it-works">
      <div class="container">
        <h2 class="section-title">Cara Memulai</h2>
        <p class="section-desc">Hanya 3 langkah mudah untuk mulai belajar.</p>
        <div class="steps">
          <div v-for="s in steps" :key="s.step" class="step-card">
            <div class="step-number">{{ s.step }}</div>
            <div class="step-icon">{{ s.icon }}</div>
            <h3 class="step-title">{{ s.title }}</h3>
            <p class="step-desc">{{ s.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta">
      <div class="container">
        <div class="cta-card">
          <h2 class="cta-title">Siap untuk mulai belajar?</h2>
          <p class="cta-desc">
            Akses semua materi perkuliahan, tugas, dan pantau progress Anda.
          </p>
          <NuxtLink to="/login" class="btn btn-primary btn-lg">
            Masuk ke LMS →
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ── Hero ─────────────────────────────────── */
.hero {
  padding: 5rem 0 3rem;
  background: linear-gradient(135deg, var(--color-primary-50) 0%, white 100%);
  text-align: center;
}

.hero-content {
  max-width: 720px;
  margin: 0 auto;
}

.hero-badge {
  display: inline-flex;
  padding: 0.375rem 1rem;
  background-color: var(--color-primary-100);
  color: var(--color-primary-700);
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.hero-title {
  font-size: 3rem;
  margin-bottom: 1rem;
  letter-spacing: -0.02em;
}

.text-primary {
  color: var(--color-primary-600);
}

.hero-desc {
  font-size: 1.125rem;
  color: var(--color-neutral-500);
  line-height: 1.7;
  margin-bottom: 2rem;
  max-width: 560px;
  margin-left: auto;
  margin-right: auto;
}

.hero-actions {
  margin-bottom: 3rem;
}

.hero-stats {
  display: flex;
  justify-content: center;
  gap: 2.5rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-primary-600);
  line-height: 1.2;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--color-neutral-500);
}

/* ── Section Shared ──────────────────────── */
.section-title {
  text-align: center;
  font-size: 2rem;
  margin-bottom: 0.75rem;
}

.section-desc {
  text-align: center;
  color: var(--color-neutral-500);
  max-width: 560px;
  margin: 0 auto 3rem;
}

/* ── Features ─────────────────────────────── */
.features {
  padding: 5rem 0;
  background-color: white;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.feature-card {
  text-align: center;
  padding: 2rem 1.5rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}

.feature-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.feature-title {
  font-size: 1.125rem;
  margin-bottom: 0.5rem;
}

.feature-desc {
  font-size: 0.875rem;
  color: var(--color-neutral-500);
  line-height: 1.6;
}

/* ── How It Works ─────────────────────────── */
.how-it-works {
  padding: 5rem 0;
  background-color: var(--color-neutral-50);
}

.steps {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
}

.step-card {
  flex: 1;
  max-width: 320px;
  text-align: center;
  padding: 2rem 1.5rem;
  position: relative;
}

.step-number {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background-color: var(--color-primary-600);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  margin: 0 auto 1rem;
}

.step-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
}

.step-title {
  font-size: 1.125rem;
  margin-bottom: 0.5rem;
}

.step-desc {
  font-size: 0.875rem;
  color: var(--color-neutral-500);
}

/* ── CTA ──────────────────────────────────── */
.cta {
  padding: 5rem 0;
  background-color: white;
}

.cta-card {
  text-align: center;
  padding: 3rem 2rem;
  border-radius: var(--radius-xl);
  background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-800));
  color: white;
}

.cta-title {
  font-size: 1.75rem;
  color: white;
  margin-bottom: 0.75rem;
}

.cta-desc {
  color: var(--color-primary-100);
  margin-bottom: 1.5rem;
}

.cta-card .btn-primary {
  background-color: white;
  color: var(--color-primary-700);
}

.cta-card .btn-primary:hover {
  background-color: var(--color-neutral-100);
}

/* ── Responsive ───────────────────────────── */
@media (max-width: 768px) {
  .hero-title { font-size: 2rem; }
  .hero-stats { gap: 1.5rem; flex-wrap: wrap; }
  .features-grid { grid-template-columns: 1fr; }
  .steps { flex-direction: column; align-items: center; }
}
</style>
