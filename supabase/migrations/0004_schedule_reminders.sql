-- Schedules the send-reminders Edge Function to run every minute via
-- pg_cron + pg_net, both available on Supabase's free tier (unlike
-- Firebase's scheduled Cloud Functions, which require the Blaze plan).
--
-- Run this AFTER deploying the Edge Function (`supabase functions deploy
-- send-reminders`) and setting its secrets, since it needs the deployed
-- URL. Replace <PROJECT_REF> below with your project ref
-- (qntpoyvlamhizmgkkokf) and <SERVICE_ROLE_KEY> with the service_role key
-- from Project Settings → API — this migration is not safe to commit
-- with real values filled in; fill them in only when running this by
-- hand in the SQL Editor.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
