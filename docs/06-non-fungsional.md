# Bagian 6: Non-Fungsional

## Demo Mode (§15)
Aplikasi harus tetap berfungsi ketika Supabase belum dikonfigurasi.

### Ketentuan
- Email dan password apa pun dapat digunakan untuk login
- Data menggunakan mock lokal (tidak permanen)
- Banner "Demo Mode" harus ditampilkan
- Demo mode tidak aktif di production jika Supabase sudah dikonfigurasi

### Cakupan Demo
- Login, dashboard, mata kuliah, materi, tugas, nilai, profil, kalender akademik, presensi, AI chat, playground

---

## Responsive Design (§17)

### Breakpoints
| Perangkat | Lebar |
|-----------|-------|
| Mobile | 320px – 767px |
| Tablet | 768px – 1023px |
| Desktop | 1024px+ |

### Ketentuan Mobile
- Sidebar → drawer
- Table → card list
- Touch target minimal 44px
- Form satu kolom
- Tidak ada horizontal overflow
- Navigasi dapat digunakan dengan keyboard

---

## Accessibility (§18)
**Target:** WCAG 2.1 Level AA

### Checklist
- ✅ Semantic HTML
- ✅ Semua input memiliki label
- ✅ Semua tombol dapat digunakan dengan keyboard
- ✅ Focus indicator terlihat
- ✅ Contrast teks mencukupi
- ✅ Gambar memiliki alt text
- ✅ Error form dibaca screen reader
- ✅ Modal dapat ditutup dengan Escape
- ✅ Heading mengikuti urutan benar
- ✅ Warna bukan satu-satunya indikator status

---

## Error Handling (§20)

### Skenario yang Ditangani
- Koneksi internet terputus
- Supabase tidak dapat diakses
- Session expired
- Login gagal
- Data tidak ditemukan
- RLS menolak query
- Submission gagal
- File terlalu besar
- URL tidak valid
- Environment variable belum diisi

### Format Pesan Error
```
[Apa yang terjadi]
[Kemungkinan penyebab]
[Tindakan yang dapat dilakukan pengguna]
```

Contoh: *"Tugas gagal dikirim. Periksa koneksi internet Anda dan coba kembali."*

---

## Testing (§22)

### Unit Testing
- **Tools:** Vitest, Vue Test Utils
- **Cakupan:** Auth store (login, role, middleware), course store (filter, progress), assignment store (status, submission), components (render, props, slots)
- **Total:** 139+ tests (stores + components)

### Component Testing
- AiChat, EmptyState, PageHeader, ProgressBar, SessionBadge, StatCard — render, props, slots, edge cases

### E2E Testing (Playwright)
1. Membuka landing page
2. Login mahasiswa (pilih role → level → session → nama)
3. Login instruktur (pilih role → nama)
4. Membuka dashboard
5. Membuka mata kuliah
6. Menandai materi selesai
7. Membuka tugas
8. Mengirim submission
9. Membuka profil
10. Logout
11. Route dashboard tidak dapat dibuka setelah logout

### Aksesibilitas (Playwright a11y)
- 8 spek E2E aksesibilitas (landing, login, dashboard, courses, lessons, assignments, profile, instructor)
- WCAG 2.1 Level AA compliance check
