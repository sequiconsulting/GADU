import { loadRegistry } from './shared/registry';
import { Client } from 'pg';

const DB_VERSION = 13;

const BASELINE_SCHEMA_SQL = `
  create extension if not exists "uuid-ossp";

  create table if not exists public.app_settings (
    id text primary key,
    data jsonb not null default '{}'::jsonb,
    db_version integer not null default 1,
    schema_version integer not null default 1,
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

  alter table public.app_settings enable row level security;
  alter table public.members enable row level security;
  alter table public.convocazioni enable row level security;

  drop policy if exists "anon_deny_app_settings" on public.app_settings;
  drop policy if exists "anon_deny_members" on public.members;
  drop policy if exists "anon_deny_convocazioni" on public.convocazioni;

  drop policy if exists "authenticated_all_app_settings" on public.app_settings;
  drop policy if exists "authenticated_all_members" on public.members;
  drop policy if exists "authenticated_all_convocazioni" on public.convocazioni;

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

  insert into public.app_settings (id, data)
  values ('app', '{}'::jsonb)
  on conflict (id) do nothing;
`;

const DB_MIGRATIONS: Record<number, string> = (() => {
  const steps: Record<number, string> = {};
  for (let v = 0; v < 13; v++) {
    steps[v] = BASELINE_SCHEMA_SQL;
  }
  return steps;
})();

async function executeSql(dbUrl: string, sql: string): Promise<void> {
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    await client.query(sql);
  } finally {
    await client.end();
  }
}

function extractPostgresUrl(supabaseUrl: string, serviceKey: string): string {
  // Extract project ID from Supabase URL: https://PROJECT.supabase.co
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) throw new Error('Invalid Supabase URL');
  
  const projectId = match[1];
  return `postgresql://postgres:${serviceKey}@db.${projectId}.supabase.co:5432/postgres`;
}

export default async (request: Request) => {
  try {
    const url = new URL(request.url);
    const glriNumber = url.searchParams.get('glriNumber') || url.searchParams.get('number');
    
    if (!glriNumber) {
      return new Response('Missing glriNumber parameter', { status: 400 });
    }
    
    const registry = await loadRegistry();
    const lodge = registry[glriNumber];
    
    if (!lodge) {
      return new Response('Lodge not found', { status: 404 });
    }

    if (!lodge.supabaseServiceKey) {
      return new Response('Service key not configured', { status: 500 });
    }

    console.log(`[UPDATE-SCHEMA] Starting schema update for lodge ${glriNumber}`);

    const dbUrl = extractPostgresUrl(lodge.supabaseUrl, lodge.supabaseServiceKey);

    // Check current db_version
    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    let currentVersion = 0;
    try {
      const result = await client.query(
        'SELECT db_version FROM public.app_settings WHERE id = $1',
        ['app']
      );
      if (result.rows && result.rows.length > 0) {
        currentVersion = result.rows[0].db_version || 0;
      }
    } catch (e) {
      console.log('[UPDATE-SCHEMA] app_settings table does not exist yet, starting from v0');
    }

    console.log(`[UPDATE-SCHEMA] Current version: ${currentVersion}, Target: ${DB_VERSION}`);

    if (currentVersion >= DB_VERSION) {
      await client.end();
      return new Response(JSON.stringify({ 
        message: 'Schema already up to date',
        currentVersion,
        targetVersion: DB_VERSION
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Apply migrations
    let version = currentVersion;
    while (version < DB_VERSION) {
      const sql = DB_MIGRATIONS[version];
      if (!sql) {
        await client.end();
        throw new Error(`No migration defined for v${version} -> v${version + 1}`);
      }

      console.log(`[UPDATE-SCHEMA] Applying migration v${version} -> v${version + 1}`);
      await client.query(sql);
      
      version += 1;

      // Update db_version
      await client.query(
        'UPDATE public.app_settings SET db_version = $1, updated_at = now() WHERE id = $2',
        [version, 'app']
      );

      console.log(`[UPDATE-SCHEMA] Migration v${version} completed`);
    }

    await client.end();

    return new Response(JSON.stringify({ 
      message: 'Schema updated successfully',
      fromVersion: currentVersion,
      toVersion: version
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[UPDATE-SCHEMA] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
