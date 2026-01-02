import { loadRegistry } from './shared/registry';

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
  for (let v = 0; v < DB_VERSION; v++) {
    steps[v] = BASELINE_SCHEMA_SQL;
  }
  return steps;
})();

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

    // Check current db_version via REST API
    let currentVersion = 0;
    try {
      const checkUrl = new URL('/rest/v1/app_settings?id=eq.app&select=db_version', lodge.supabaseUrl).toString();
      const checkResponse = await fetch(checkUrl, {
        headers: {
          apikey: lodge.supabaseServiceKey,
          Authorization: `Bearer ${lodge.supabaseServiceKey}`,
        },
      });

      if (checkResponse.ok) {
        const data = await checkResponse.json() as any[];
        if (data && data.length > 0) {
          currentVersion = data[0].db_version || 0;
        }
      } else {
        currentVersion = 0;
      }
    } catch (e) {
      currentVersion = 0;
    }

    console.log(`[UPDATE-SCHEMA] Current version: ${currentVersion}, Target: ${DB_VERSION}`);

    if (currentVersion >= DB_VERSION) {
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
        throw new Error(`No migration defined for v${version} -> v${version + 1}`);
      }

      console.log(`[UPDATE-SCHEMA] Applying migration v${version} -> v${version + 1}`);
      
      const sqlUrl = new URL('/rest/v1/rpc/query', lodge.supabaseUrl).toString();
      const sqlResponse = await fetch(sqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: lodge.supabaseServiceKey,
          Authorization: `Bearer ${lodge.supabaseServiceKey}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      if (!sqlResponse.ok) {
        const errorText = await sqlResponse.text();
        throw new Error(`SQL execution failed (${sqlResponse.status}): ${errorText}`);
      }

      version += 1;

      const updateUrl = new URL(`/rest/v1/app_settings?id=eq.app`, lodge.supabaseUrl).toString();
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: lodge.supabaseServiceKey,
          Authorization: `Bearer ${lodge.supabaseServiceKey}`,
        },
        body: JSON.stringify({
          db_version: version,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update db_version: ${errorText}`);
      }

      console.log(`[UPDATE-SCHEMA] Migration v${version} completed`);
    }

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
