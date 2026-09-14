-- Copre la foreign key analytics_raw.company_id segnalata dal
-- Performance Advisor ("Unindexed foreign keys"): evita scansioni
-- sequenziali su JOIN/DELETE CASCADE per company.

create index if not exists idx_analytics_raw_company_id
  on analytics_raw(company_id);
