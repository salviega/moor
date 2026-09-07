-- The agent's schedule (05 §8): one cycle every five minutes, pg_cron calling the
-- agent-cycle Edge Function through pg_net. The project URL and the anon key are
-- read from Vault so nothing project-specific is committed. Before `supabase db push`:
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<anon key>', 'anon_key');
--
-- The anon key is the public one every client already carries; verify_jwt on the
-- function only keeps out requests that carry no project key at all.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'moor-agent-cycle',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/agent-cycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
