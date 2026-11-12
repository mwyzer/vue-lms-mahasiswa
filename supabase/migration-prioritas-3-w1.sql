-- ============================================
-- LMS Mahasiswa — Migrasi Prioritas 3 (W1)
--   Flashcard pribadi + spaced repetition (SM-2)
--
-- Jalankan SETELAH schema.sql, policies.sql, migration-prioritas-1.sql
-- (fungsi public.current_profile_id()) dan migration-prioritas-2.sql.
-- Aman dijalankan ulang (idempotent).
--
-- Jalur belajar adaptif (/student/learning-path) TIDAK butuh tabel baru:
-- ia membaca quizzes, quiz_questions, quiz_attempts, quiz_answers dan lessons.
-- ============================================

-- ────────────────────────────────────────────
-- 1. Tabel flashcards — satu baris per kartu milik satu user
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  front TEXT NOT NULL CHECK (char_length(btrim(front)) BETWEEN 1 AND 300),
  back TEXT NOT NULL CHECK (char_length(btrim(back)) BETWEEN 1 AND 800),
  -- Kartu AI hanya disimpan setelah user menekan "Simpan"; draf hidup di klien.
  -- Status 'draft' disediakan bila kelak draf ingin disimpan di server.
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai', 'demo')),
  -- SM-2
  ease_factor NUMERIC(4,2) NOT NULL DEFAULT 2.50 CHECK (ease_factor >= 1.30),
  interval_days INTEGER NOT NULL DEFAULT 0 CHECK (interval_days BETWEEN 0 AND 3650),
  repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  lapses INTEGER NOT NULL DEFAULT 0 CHECK (lapses >= 0),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Antrian review: kartu aktif milik user yang jatuh tempo.
CREATE INDEX IF NOT EXISTS idx_flashcards_user_due ON flashcards(user_id, due_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_flashcards_user_course ON flashcards(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_lesson ON flashcards(lesson_id) WHERE lesson_id IS NOT NULL;

-- ────────────────────────────────────────────
-- 2. Tabel flashcard_reviews — log setiap review (statistik)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashcard_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quality SMALLINT NOT NULL CHECK (quality BETWEEN 0 AND 5),
  interval_days INTEGER NOT NULL CHECK (interval_days >= 0),
  ease_factor NUMERIC(4,2) NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_user_time ON flashcard_reviews(user_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_card ON flashcard_reviews(card_id);

-- ────────────────────────────────────────────
-- 3. RLS — kartu dan log review hanya bisa diakses pemiliknya
-- ────────────────────────────────────────────
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner reads flashcards" ON flashcards;
CREATE POLICY "Owner reads flashcards"
  ON flashcards FOR SELECT USING (user_id = public.current_profile_id());

-- Kartu yang ditautkan ke mata kuliah hanya boleh untuk mata kuliah yang diikuti/diampu.
DROP POLICY IF EXISTS "Owner creates flashcards" ON flashcards;
CREATE POLICY "Owner creates flashcards"
  ON flashcards FOR INSERT
  WITH CHECK (
    user_id = public.current_profile_id()
    AND (course_id IS NULL OR public.is_course_member(course_id))
  );

DROP POLICY IF EXISTS "Owner updates flashcards" ON flashcards;
CREATE POLICY "Owner updates flashcards"
  ON flashcards FOR UPDATE
  USING (user_id = public.current_profile_id())
  WITH CHECK (
    user_id = public.current_profile_id()
    AND (course_id IS NULL OR public.is_course_member(course_id))
  );

DROP POLICY IF EXISTS "Owner deletes flashcards" ON flashcards;
CREATE POLICY "Owner deletes flashcards"
  ON flashcards FOR DELETE USING (user_id = public.current_profile_id());

DROP POLICY IF EXISTS "Owner reads flashcard reviews" ON flashcard_reviews;
CREATE POLICY "Owner reads flashcard reviews"
  ON flashcard_reviews FOR SELECT USING (user_id = public.current_profile_id());

DROP POLICY IF EXISTS "Owner logs flashcard reviews" ON flashcard_reviews;
CREATE POLICY "Owner logs flashcard reviews"
  ON flashcard_reviews FOR INSERT
  WITH CHECK (
    user_id = public.current_profile_id()
    AND EXISTS (SELECT 1 FROM flashcards f WHERE f.id = card_id AND f.user_id = public.current_profile_id())
  );

DROP POLICY IF EXISTS "Owner deletes flashcard reviews" ON flashcard_reviews;
CREATE POLICY "Owner deletes flashcard reviews"
  ON flashcard_reviews FOR DELETE USING (user_id = public.current_profile_id());

-- ────────────────────────────────────────────
-- 4. Catatan jalur belajar
--    /student/learning-path membaca quiz_answers milik mahasiswa sendiri
--    (filter student_id). Migrasi ini sengaja TIDAK mengubah RLS quiz_answers
--    agar akses instruktur yang sudah ada tidak rusak. Bila quiz_answers kosong
--    atau tidak terbaca, skor per topik diestimasi dari quiz_attempts.
-- ────────────────────────────────────────────
