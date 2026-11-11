-- ============================================
-- LMS Mahasiswa — Migrasi Prioritas 2 (fitur AI)
--   1. pgvector + tabel lesson_chunks (potongan materi + embedding untuk RAG tutor)
--   2. Fungsi match_lesson_chunks (pencarian kemiripan kosinus, khusus service role)
--
-- Jalankan SETELAH migration-prioritas-1.sql (butuh public.is_course_member).
-- Aman dijalankan ulang (idempotent).
--
-- Catatan embedding_mode:
--   server/utils/ai.ts → embedTexts() mengembalikan vektor 1536 dimensi dari API
--   ('api') ATAU embedding lokal leksikal ('local', mode demo / API gagal).
--   Keduanya TIDAK sebanding, jadi setiap baris menyimpan mode-nya dan pencarian
--   hanya membandingkan vektor dengan mode yang sama.
-- ============================================

-- ────────────────────────────────────────────
-- 0. Extension
-- ────────────────────────────────────────────
-- Di Supabase extension diletakkan di schema "extensions", yang sudah ada di search_path
-- default (SQL editor / service role). Tipe `vector` sengaja tidak di-qualify agar tetap
-- jalan bila pgvector sudah lebih dulu diaktifkan di schema public.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============================================
-- 1. LESSON CHUNKS
-- ============================================
CREATE TABLE IF NOT EXISTS public.lesson_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding vector(1536),
  embedding_mode TEXT NOT NULL DEFAULT 'api',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lesson_id, chunk_index)
);

-- Untuk instalasi yang sudah punya tabel versi awal tanpa kolom mode.
ALTER TABLE public.lesson_chunks ADD COLUMN IF NOT EXISTS embedding_mode TEXT NOT NULL DEFAULT 'api';

ALTER TABLE public.lesson_chunks DROP CONSTRAINT IF EXISTS lesson_chunks_embedding_mode_check;
ALTER TABLE public.lesson_chunks
  ADD CONSTRAINT lesson_chunks_embedding_mode_check CHECK (embedding_mode IN ('api', 'local'));

CREATE INDEX IF NOT EXISTS idx_lesson_chunks_course ON public.lesson_chunks (course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_chunks_embedding_hnsw
  ON public.lesson_chunks USING hnsw (embedding vector_cosine_ops);

-- ── RLS: anggota mata kuliah boleh membaca. Tidak ada policy tulis:
--    INSERT/UPDATE/DELETE hanya lewat service role dari server (bypass RLS).
ALTER TABLE public.lesson_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read lesson chunks" ON public.lesson_chunks;
CREATE POLICY "Members read lesson chunks"
  ON public.lesson_chunks FOR SELECT USING (public.is_course_member(course_id));

-- ============================================
-- 2. match_lesson_chunks — top-k potongan materi termirip
-- ============================================
-- similarity = 1 - jarak kosinus (1 = identik). Hanya baris dengan
-- embedding_mode = p_embedding_mode yang dibandingkan. p_match_count dibatasi 1..50.
CREATE OR REPLACE FUNCTION public.match_lesson_chunks(
  query_embedding vector(1536),
  p_course_ids UUID[],
  p_match_count INTEGER DEFAULT 5,
  p_embedding_mode TEXT DEFAULT 'api'
)
RETURNS TABLE (
  lesson_id UUID,
  course_id UUID,
  chunk_index INTEGER,
  content TEXT,
  similarity DOUBLE PRECISION
)
LANGUAGE sql STABLE SET search_path = public, extensions
AS $$
  SELECT
    lc.lesson_id,
    lc.course_id,
    lc.chunk_index,
    lc.content,
    (1 - (lc.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity
  FROM public.lesson_chunks lc
  WHERE lc.course_id = ANY (p_course_ids)
    AND lc.embedding IS NOT NULL
    AND lc.embedding_mode = p_embedding_mode
  ORDER BY lc.embedding <=> query_embedding
  LIMIT GREATEST(1, LEAST(COALESCE(p_match_count, 5), 50));
$$;

-- Hanya service role yang boleh memanggil (bukan klien biasa).
REVOKE ALL ON FUNCTION public.match_lesson_chunks(vector, UUID[], INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_lesson_chunks(vector, UUID[], INTEGER, TEXT) TO service_role;
