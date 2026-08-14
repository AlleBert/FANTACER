-- Enable Realtime for admin dashboard live updates
-- Tables: sponsors, companies, vote_sessions, site_settings, batch_settings

ALTER PUBLICATION supabase_realtime ADD TABLE sponsors;
ALTER PUBLICATION supabase_realtime ADD TABLE companies;
ALTER PUBLICATION supabase_realtime ADD TABLE vote_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE site_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE batch_settings;
