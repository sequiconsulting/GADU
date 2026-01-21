// Baseline schema SQL (ultima versione)
const BASELINE_SCHEMA_SQL = `
create extension if not exists "uuid-ossp";

create or replace function public.query(sql text) returns void as $$
begin
  execute sql;
end;
$$ language plpgsql security definer;

create table if not exists public.app_settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  db_version integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists members_lastname_idx on public.members ((data ->> 'lastName'));

create table if not exists public.convocazioni (
  id uuid primary key default gen_random_uuid(),
  branch_type text not null,
  year_start integer not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists convocazioni_branch_idx on public.convocazioni (branch_type);
create index if not exists convocazioni_year_idx on public.convocazioni (year_start);

create table if not exists public.rendiconto_fiscale (
  year_start integer primary key,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.capitazioni_quotes (
  id uuid primary key default gen_random_uuid(),
  year_start integer not null,
  branch_type text not null,
  by_tipo jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(year_start, branch_type)
);

create index if not exists capitazioni_quotes_year_branch_idx on public.capitazioni_quotes (year_start, branch_type);

alter table public.capitazioni_quotes enable row level security;
alter table public.members enable row level security;
alter table public.convocazioni enable row level security;
alter table public.rendiconto_fiscale enable row level security;

drop policy if exists "anon_deny_app_settings" on public.app_settings;
drop policy if exists "anon_deny_members" on public.members;
drop policy if exists "anon_deny_convocazioni" on public.convocazioni;
drop policy if exists "anon_deny_rendiconto_fiscale" on public.rendiconto_fiscale;

drop policy if exists "authenticated_all_app_settings" on public.app_settings;
drop policy if exists "authenticated_all_members" on public.members;
drop policy if exists "authenticated_all_convocazioni" on public.convocazioni;
drop policy if exists "authenticated_all_rendiconto_fiscale" on public.rendiconto_fiscale;

create policy "anon_deny_app_settings" 
  on public.app_settings 
  for all 
  using (auth.role() != 'anon') 
  with check (auth.role() != 'anon');

create policy "anon_deny_members" 
  on public.members 
  for all 
  using (auth.role() != 'anon') 
  with check (auth.role() != 'anon');

create policy "anon_deny_convocazioni" 
  on public.convocazioni 
  for all 
  using (auth.role() != 'anon') 
  with check (auth.role() != 'anon');

create policy "anon_deny_rendiconto_fiscale" 
  on public.rendiconto_fiscale 
  for all 
  using (auth.role() != 'anon') 
  with check (auth.role() != 'anon');

create policy "authenticated_all_app_settings" 
  on public.app_settings 
  for all 
  using (auth.role() = 'authenticated') 
  with check (auth.role() = 'authenticated');

create policy "authenticated_all_members" 
  on public.members 
  for all 
  using (auth.role() = 'authenticated') 
  with check (auth.role() = 'authenticated');

create policy "authenticated_all_convocazioni" 
  on public.convocazioni 
  for all 
  using (auth.role() = 'authenticated') 
  with check (auth.role() = 'authenticated');

create policy "authenticated_all_rendiconto_fiscale" 
  on public.rendiconto_fiscale 
  for all 
  using (auth.role() = 'authenticated') 
  with check (auth.role() = 'authenticated');

drop policy if exists "anon_deny_capitazioni_quotes" on public.capitazioni_quotes;
create policy "anon_deny_capitazioni_quotes" 
  on public.capitazioni_quotes 
  for all 
  using (auth.role() != 'anon') 
  with check (auth.role() != 'anon');

drop policy if exists "authenticated_all_capitazioni_quotes" on public.capitazioni_quotes;
create policy "authenticated_all_capitazioni_quotes" 
  on public.capitazioni_quotes 
  for all 
  using (auth.role() = 'authenticated') 
  with check (auth.role() = 'authenticated');
`;
import { Handler } from '@netlify/functions';
import { initNetlifyBlobs, loadRegistry } from './shared/registry';
import postgres from 'postgres';
import { join } from 'path';

const DB_VERSION = 20;

// Database schema migrations (incremental changes only, not baseline)
const DB_MIGRATIONS: Record<number, string> = {
  // Esempio di migrazione no-op ma idempotente per verificare il flusso v13 -> v14
  13: `
    ALTER TABLE public.app_settings
      ALTER COLUMN updated_at SET DEFAULT now();
  `,

  // v14 -> v15: cambio formato JSON (no DDL). Migrazione no-op ma tracciata.
  14: `
    SELECT 1;
  `,

  // v15 -> v16: rename ramo Arch (solo shape JSON lato app). Migrazione no-op ma tracciata.
  15: `
    SELECT 1;
  `,

  // v16 -> v17: aggiungi tabella capitazioni_quotes per quote customizzabili per anno/ramo
  16: `
    CREATE TABLE IF NOT EXISTS public.capitazioni_quotes (
      id uuid primary key default gen_random_uuid(),
      year_start integer not null,
      branch_type text not null,
      quota_gl numeric(10, 2) not null default 0,
      quota_regionale numeric(10, 2) not null default 0,
      quota_loggia numeric(10, 2) not null default 0,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      unique(year_start, branch_type)
    );
    CREATE INDEX IF NOT EXISTS capitazioni_quotes_year_branch_idx ON public.capitazioni_quotes (year_start, branch_type);
    ALTER TABLE public.capitazioni_quotes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "anon_deny_capitazioni_quotes" ON public.capitazioni_quotes;
    CREATE POLICY "anon_deny_capitazioni_quotes" 
      ON public.capitazioni_quotes 
      FOR ALL 
      USING (auth.role() != 'anon') 
      WITH CHECK (auth.role() != 'anon');
    DROP POLICY IF EXISTS "authenticated_all_capitazioni_quotes" ON public.capitazioni_quotes;
    CREATE POLICY "authenticated_all_capitazioni_quotes" 
      ON public.capitazioni_quotes 
      FOR ALL 
      USING (auth.role() = 'authenticated') 
      WITH CHECK (auth.role() = 'authenticated');
  `,

  // v17 -> v18: migra capitazioni_quotes da singole colonne a by_tipo JSON con tutti i tipi
  17: `
    -- Aggiungi colonna by_tipo se non esiste
    ALTER TABLE public.capitazioni_quotes
      ADD COLUMN IF NOT EXISTS by_tipo jsonb default '{}'::jsonb;
    
    -- Migra dati dalle colonne vecchie al nuovo formato JSON per ogni tipo di capitazione
    -- Nota: questa migrazione assume che i dati esistenti siano "Ordinaria" con le tre quote
    -- Se ci sono altri tipi, dovranno essere gestiti manualmente o in un'altra fase
    UPDATE public.capitazioni_quotes
    SET by_tipo = jsonb_build_object(
      'Ordinaria', jsonb_build_object(
        'quota_gl', COALESCE(quota_gl, 0),
        'quota_regionale', COALESCE(quota_regionale, 0),
        'quota_loggia', COALESCE(quota_loggia, 0)
      )
    )
    WHERE by_tipo = '{}'::jsonb OR by_tipo IS NULL;
    
    -- Rimuovi le vecchie colonne se non sono più necessarie
    ALTER TABLE public.capitazioni_quotes
      DROP COLUMN IF EXISTS quota_gl;
    ALTER TABLE public.capitazioni_quotes
      DROP COLUMN IF EXISTS quota_regionale;
    ALTER TABLE public.capitazioni_quotes
      DROP COLUMN IF EXISTS quota_loggia;
  `
,

  // v18 -> v19: cambio shape JSON lato app (Capitazioni: pagato numerico, rimozione data_pagamento). Nessun DDL.
  18: `
    SELECT 1;
  `,

  // v19 -> v20: aggiungi tabella rendiconto_fiscale
  19: `
    CREATE TABLE IF NOT EXISTS public.rendiconto_fiscale (
      year_start integer primary key,
      data jsonb not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    ALTER TABLE public.rendiconto_fiscale ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "anon_deny_rendiconto_fiscale" ON public.rendiconto_fiscale;
    CREATE POLICY "anon_deny_rendiconto_fiscale" 
      ON public.rendiconto_fiscale 
      FOR ALL 
      USING (auth.role() != 'anon') 
      WITH CHECK (auth.role() != 'anon');

    DROP POLICY IF EXISTS "authenticated_all_rendiconto_fiscale" ON public.rendiconto_fiscale;
    CREATE POLICY "authenticated_all_rendiconto_fiscale" 
      ON public.rendiconto_fiscale 
      FOR ALL 
      USING (auth.role() = 'authenticated') 
      WITH CHECK (auth.role() = 'authenticated');
  `
};


function extractPostgresUrl(supabaseUrl: string, databasePassword: string): string {
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) throw new Error('Invalid Supabase URL');
  const projectId = match[1];
  // Use Supabase Shared Pooler - Session Mode (IPv4, port 5432) for DDL migrations
  // Session mode supports prepared statements and complex DDL operations
  // Format: postgres://postgres.PROJECT:[PASSWORD]@aws-1-REGION.pooler.supabase.com:5432/postgres
  return `postgresql://postgres.${projectId}:${databasePassword}@aws-1-eu-west-3.pooler.supabase.com:5432/postgres`;
}

async function connectWithRetry(dbUrl: string, maxRetries: number = 3) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const sql = postgres(dbUrl, { max: 1 });
      // Test connection
      await sql`SELECT 1`;
      return sql;
    } catch (error: any) {
      lastError = error;
      console.warn(`[UPDATE-SCHEMA] Connection attempt ${i + 1}/${maxRetries} failed:`, error.message);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

export const handler: Handler = async (event) => {
  let sql: any = null;

  try {
    initNetlifyBlobs(event);
    
    // Accetta sia GET (legacy) che POST (new)
    let glriNumber: string | undefined;
    let databasePassword: string | undefined;

    if (event.httpMethod === 'POST') {
      // New: ricevi dal body
      const body = event.body ? JSON.parse(event.body) : {};
      glriNumber = body.glriNumber?.trim();
      databasePassword = body.databasePassword?.trim();
      
      if (!glriNumber || !databasePassword) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing glriNumber or databasePassword in body' })
        };
      }
      console.log(`[UPDATE-SCHEMA] POST request for lodge ${glriNumber}`);
    } else {
      // Legacy: ricevi da query parameters (retrocompatibilità)
      glriNumber = event.queryStringParameters?.glriNumber || event.queryStringParameters?.number;
      
      if (!glriNumber) {
        return {
          statusCode: 400,
          body: 'Missing glriNumber parameter'
        };
      }
      
      // Se è GET, carica dal registry (legacy)
      console.log(`[UPDATE-SCHEMA] GET request for lodge ${glriNumber}, loading from registry`);
      const registry = await loadRegistry();
      const lodge = registry[glriNumber];
      
      if (!lodge) {
        return {
          statusCode: 404,
          body: 'Lodge not found'
        };
      }
      
      if (!lodge.databasePassword) {
        return {
          statusCode: 500,
          body: 'Database password not configured'
        };
      }
      
      databasePassword = lodge.databasePassword;
    }

    console.log(`[UPDATE-SCHEMA] Starting schema update for lodge ${glriNumber}`);

    // Ricava supabaseUrl dal registry (necessario per estrapolare l'host Postgres)
    const registry = await loadRegistry();
    const lodge = registry[glriNumber];
    if (!lodge || !lodge.supabaseUrl) {
      return {
        statusCode: 500,
        body: 'Lodge or supabaseUrl not found in registry'
      };
    }

    // Connect directly via postgres
    const dbUrl = extractPostgresUrl(lodge.supabaseUrl, databasePassword!);
    console.log('[UPDATE-SCHEMA] Connecting to postgres...');
    sql = await connectWithRetry(dbUrl);
    console.log('[UPDATE-SCHEMA] Connected to postgres');

    // Get current db_version
    console.log('[UPDATE-SCHEMA] Reading current db_version...');
    let currentVersion = 0;
    let result;
    try {
      result = await sql`SELECT db_version FROM public.app_settings WHERE id = 'app'`;
      if (result.length > 0) {
        currentVersion = result[0].db_version || 0;
      } else {
        // Schema non inizializzato: esegui baseline
        console.warn('[UPDATE-SCHEMA] Schema not initialized - applying baseline schema');
        await sql.unsafe(BASELINE_SCHEMA_SQL);
        // Dopo baseline, imposta currentVersion
        result = await sql`SELECT db_version FROM public.app_settings WHERE id = 'app'`;
        if (result.length > 0) {
          currentVersion = result[0].db_version || 1;
        } else {
          currentVersion = 1;
        }
      }
    } catch (e) {
      // Se la tabella non esiste, crea tutto da zero
      console.warn('[UPDATE-SCHEMA] app_settings missing, applying baseline schema');
      await sql.unsafe(BASELINE_SCHEMA_SQL);
      result = await sql`SELECT db_version FROM public.app_settings WHERE id = 'app'`;
      if (result.length > 0) {
        currentVersion = result[0].db_version || 1;
      } else {
        currentVersion = 1;
      }
    }
    console.log(`[UPDATE-SCHEMA] Current version: ${currentVersion}, Target: ${DB_VERSION}`);

    if (currentVersion >= DB_VERSION) {
      console.log('[UPDATE-SCHEMA] Schema already up to date');
      await sql.end();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Schema already up to date',
          currentVersion,
          targetVersion: DB_VERSION
        })
      };
    }

    // Apply migrations
    let version = currentVersion;
    while (version < DB_VERSION) {
      const migrationSql = DB_MIGRATIONS[version];
      if (!migrationSql) {
        // No specific migration for this version, just increment
        console.log(`[UPDATE-SCHEMA] No migration defined for v${version}, skipping to v${version + 1}`);
        version += 1;

        console.log(`[UPDATE-SCHEMA] Updating db_version to ${version}...`);
        await sql`
          UPDATE public.app_settings 
          SET db_version = ${version}, updated_at = now() 
          WHERE id = 'app'
        `;
        continue;
      }

      console.log(`[UPDATE-SCHEMA] Applying migration v${version} -> v${version + 1}`);
      await sql.unsafe(migrationSql);

      version += 1;
      console.log(`[UPDATE-SCHEMA] Updating db_version to ${version}...`);
      await sql`
        UPDATE public.app_settings 
        SET db_version = ${version}, updated_at = now() 
        WHERE id = 'app'
      `;
      console.log(`[UPDATE-SCHEMA] Migration v${version - 1} -> v${version} completed`);
    }

    await sql.end();
    sql = null;

    console.log('[UPDATE-SCHEMA] Schema update completed successfully');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Schema updated successfully',
        fromVersion: currentVersion,
        toVersion: version
      })
    };

  } catch (error: any) {
    console.error('[UPDATE-SCHEMA] Error:', error.message, error.stack);
    if (sql) {
      try {
        await sql.end();
      } catch (e) {
        console.warn('[UPDATE-SCHEMA] Error closing connection:', e);
      }
    }
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message,
        details: error.toString()
      })
    };
  }
};
