-- Flag Fine Fiera + config orari (site_settings). Default: spento.
insert into public.site_settings (key, value)
values
  ('fair_end_enabled', 'false'),
  ('fair_end_config',
   '{"revealTime":"12:30","revealAt":null,"ceremony":{"1":"14:00","2":"13:45","3":"13:30"}}')
on conflict (key) do nothing;
