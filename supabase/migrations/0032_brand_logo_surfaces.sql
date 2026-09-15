-- Per-surface primary logos (two-step Brand Studio, D12): each logo is
-- tagged for dark surfaces, light surfaces, or both (surfaces[] rides in
-- brand_assets.metadata, no column needed), and each surface has its own
-- primary. Two nullable columns beside primary_logo_asset_id, which stays
-- exactly as it is — onboarding writes it, BrandContext.primaryLogoUrl and
-- the public path read it, and the studio keeps it in step with the dark
-- primary (falling back to light) on every save.
alter table brand_kits
  add column primary_logo_dark_asset_id uuid references brand_assets(id) on delete set null,
  add column primary_logo_light_asset_id uuid references brand_assets(id) on delete set null;

-- Backfill: the one primary a kit had is the primary on both surfaces
-- until the studio says otherwise.
update brand_kits
set
  primary_logo_dark_asset_id = primary_logo_asset_id,
  primary_logo_light_asset_id = primary_logo_asset_id
where primary_logo_asset_id is not null;
