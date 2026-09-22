-- Flag anti-bot: quando attiva, sospende il voto e nasconde la classifica live.
-- Default 'false' (nessun blocco). Stessa tabella/RLS/publication delle altre flag.

INSERT INTO public.site_settings (key, value)
VALUES ('antibot_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
