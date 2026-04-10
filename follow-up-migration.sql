-- Follow-up Contact Form: separate table for contact details
-- Run in Supabase SQL Editor
-- Keeps contact info completely separate from anonymous feedback sessions

-- ─── Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follow_up_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_method TEXT NOT NULL CHECK (contact_method IN ('email', 'phone', 'teams')),
  contact_details TEXT NOT NULL,
  availability_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'completed', 'declined')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.follow_up_contacts ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous/unauthenticated) can submit the form
CREATE POLICY "Anyone can submit follow-up contact"
  ON public.follow_up_contacts FOR INSERT
  WITH CHECK (true);

-- Only authenticated users (admins) can view submissions
CREATE POLICY "Authenticated users can read follow-up contacts"
  ON public.follow_up_contacts FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only authenticated users can update status/notes
CREATE POLICY "Authenticated users can update follow-up contacts"
  ON public.follow_up_contacts FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ─── Index for admin queries ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_follow_up_contacts_status
  ON public.follow_up_contacts (status, created_at DESC);

-- ─── Notification trigger (sends webhook on new submission) ───
-- This calls a Supabase Edge Function to notify the admin.
-- The Edge Function URL is populated after deployment.

CREATE OR REPLACE FUNCTION notify_follow_up_submission()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/notify-follow-up',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'id', NEW.id,
      'name', NEW.name,
      'contact_method', NEW.contact_method,
      'contact_details', NEW.contact_details,
      'availability_notes', NEW.availability_notes,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block the insert if notification fails
  RAISE WARNING 'Follow-up notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_follow_up_contact_inserted
  AFTER INSERT ON public.follow_up_contacts
  FOR EACH ROW
  EXECUTE FUNCTION notify_follow_up_submission();
