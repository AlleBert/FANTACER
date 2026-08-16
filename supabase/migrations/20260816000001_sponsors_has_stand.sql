-- Add has_stand flag to sponsors
-- When true, the sponsor logo appears in the gadget pickup cards (prize-location section).

alter table sponsors
  add column if not exists has_stand boolean not null default false;