-- Insert default voting_enabled setting if not exists
INSERT INTO site_settings (key, value, updated_at)
VALUES ('voting_enabled', 'true', NOW())
ON CONFLICT (key) DO NOTHING;
