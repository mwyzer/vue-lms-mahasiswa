-- ============================================
-- LMS Mahasiswa — Hardening hak akses fungsi (Prioritas 3)
--
-- Jalankan SETELAH migration-prioritas-1.sql s/d migration-prioritas-3b-a.sql.
-- Aman dijalankan ulang (idempotent).
--
-- Di Supabase, fungsi di schema public otomatis bisa dipanggil lewat
-- /rest/v1/rpc oleh role anon dan authenticated. Fungsi trigger dan fungsi cron
-- tidak perlu terbuka. Helper RLS (current_profile_id, is_course_member,
-- is_course_staff, dst.) sengaja dibiarkan: policy RLS memanggilnya dengan hak
-- pemanggil, dan hanya mengembalikan data milik pemanggil sendiri.
-- ============================================

-- Trigger functions
REVOKE EXECUTE ON FUNCTION public.notify_new_assignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_graded_submission() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_announcement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_forum_reply() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_badge_earned() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.peer_reviews_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_peer_review_assigned() FROM PUBLIC, anon, authenticated;

-- Fungsi cron: hanya service role
REVOKE EXECUTE ON FUNCTION public.notify_peer_review_deadlines(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_peer_review_deadlines(INTEGER) TO service_role;

-- RPC peer review: hanya user login
REVOKE EXECUTE ON FUNCTION public.get_peer_review_tasks() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_received_peer_reviews() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_peer_review_tasks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_received_peer_reviews() TO authenticated;

-- Pengingat dosen: hanya user login (dan service role)
REVOKE EXECUTE ON FUNCTION public.send_risk_reminder(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_risk_reminder(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated, service_role;
