-- ============================================
-- LMS Mahasiswa — Migrasi Prioritas 3b-A
--   Jawaban per soal pada percobaan kuis (untuk jalur belajar adaptif)
--
-- Jalankan SETELAH schema.sql (atau migration-missing-tables.sql).
-- Aman dijalankan ulang (idempotent).
--
-- Perubahan:
--   quiz_attempts.answers  JSONB  — array jawaban per soal milik percobaan ini:
--       [{ "question_id": "...", "jawaban": "a"|"b"|"c"|"d"|null,
--          "is_correct": true|false, "points": 1|0 }, ...]
--     Soal yang tidak dijawab tetap dicatat dengan jawaban null.
--     Percobaan lama: answers = NULL → jalur belajar memakai quiz_answers
--     atau estimasi dari percentage (kompatibel mundur).
--   quiz_answers.attempt_id UUID  — tautan baris jawaban ke percobaannya
--   quiz_answers.points     INTEGER — poin yang diperoleh untuk soal tsb.
--
-- Store kuis (app/stores/quiz.ts → persistAttempt) mengisi keduanya dan
-- otomatis mencoba ulang tanpa kolom baru bila migrasi ini belum dijalankan.
-- RLS tidak diubah.
-- ============================================

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS answers JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_answers_is_array'
  ) THEN
    ALTER TABLE quiz_attempts
      ADD CONSTRAINT quiz_attempts_answers_is_array
      CHECK (answers IS NULL OR jsonb_typeof(answers) = 'array');
  END IF;
END $$;

ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS attempt_id UUID;
ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_answers_attempt_id_fkey'
  ) THEN
    ALTER TABLE quiz_answers
      ADD CONSTRAINT quiz_answers_attempt_id_fkey
      FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt ON quiz_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_student ON quiz_answers(student_id);

-- Isi points untuk baris lama (1 poin per jawaban benar). Idempoten.
UPDATE quiz_answers SET points = 1 WHERE is_correct AND points = 0;
