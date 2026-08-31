-- ETAPA 2: tipos compartilhados. Nenhum dado é inserido por esta migration.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

create type public.app_role as enum ('ADMIN', 'GESTOR', 'LEITURA');
create type public.supply_group as enum ('REDE', 'XIXOVA');
create type public.equipment_status as enum (
  'NOT_INSTALLED', 'INSTALLED_NOT_COMMISSIONED', 'AVAILABLE',
  'UNAVAILABLE', 'FAILED', 'MAINTENANCE'
);
create type public.import_status as enum ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL');
create type public.measurement_source_type as enum ('DMC', 'SUPPLY_OUTLET');
create type public.measurement_channel_type as enum (
  'PRESSURE_PC', 'PRESSURE_UPSTREAM', 'PRESSURE_DOWNSTREAM',
  'PRESSURE_SUPPLY', 'FLOW', 'OTHER'
);
create type public.quality_flag_type as enum (
  'MISSING_TIMESTAMP', 'DUPLICATE', 'NULL_VALUE', 'ZERO_STREAK', 'OUTLIER',
  'IMPOSSIBLE_VALUE', 'SENSOR_FAILURE', 'EQUIPMENT_UNAVAILABLE',
  'PRE_INSTALLATION', 'POST_FAILURE', 'MANUAL_REVIEW', 'OTHER'
);
create type public.quality_severity as enum ('INFO', 'WARNING', 'INVALID');
create type public.flag_detector as enum ('SYSTEM', 'USER');
create type public.performance_status as enum (
  'MEDIDO_SABESP', 'REALIZADO_ATUAL', 'PROJETADO', 'PARCIAL',
  'DESCONSIDERADO', 'CALCULADO', 'ESTIMADO', 'NAO_DISPONIVEL'
);
create type public.analysis_status as enum ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL');

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
