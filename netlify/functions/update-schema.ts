import { loadRegistry } from './shared/registry';
import { Client } from 'pg';
import { join } from 'path';

const DB_VERSION = 13;

// Database schema migrations (incremental changes only, not baseline)
const DB_MIGRATIONS: Record<number, string> = {
  // Future migrations go here as DB_VERSION increases
  // Example: 13: 'ALTER TABLE members ADD COLUMN IF NOT EXISTS custom_field text;'
};

function extractPostgresUrl(supabaseUrl: string, serviceKey: string): string {
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) throw new Error('Invalid Supabase URL');
  const projectId = match[1];
  return `postgresql://postgres:${serviceKey}@db.${projectId}.supabase.co:5432/postgres`;
}

async function connectWithRetry(dbUrl: string, maxRetries: number = 3): Promise<Client> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = new Client({ connectionString: dbUrl });
      await client.connect();
      return client;
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

export default async (request: Request) => {
  let client: Client | null = null;

  try {
    const url = new URL(request.url);
    const glriNumber = url.searchParams.get('glriNumber') || url.searchParams.get('number');
    
    if (!glriNumber) {
      return new Response('Missing glriNumber parameter', { status: 400 });
    }
    
    console.log(`[UPDATE-SCHEMA] Loading registry for lodge ${glriNumber}`);
    const registry = await loadRegistry();
    const lodge = registry[glriNumber];
    
    if (!lodge) {
      return new Response('Lodge not found', { status: 404 });
    }

    if (!lodge.supabaseServiceKey) {
      return new Response('Service key not configured', { status: 500 });
    }

    console.log(`[UPDATE-SCHEMA] Starting schema update for lodge ${glriNumber}`);

    // Connect directly via postgres
    const dbUrl = extractPostgresUrl(lodge.supabaseUrl, lodge.supabaseServiceKey);
    console.log('[UPDATE-SCHEMA] Connecting to postgres...');
    client = await connectWithRetry(dbUrl);
    console.log('[UPDATE-SCHEMA] Connected to postgres');

    // Get current db_version
    console.log('[UPDATE-SCHEMA] Reading current db_version...');
    const result = await client.query(
      'SELECT db_version FROM public.app_settings WHERE id = $1',
      ['app']
    );

    if (result.rows.length === 0) {
      console.warn('[UPDATE-SCHEMA] Schema not initialized - app_settings not found');
      await client.end();
      return new Response(JSON.stringify({ 
        error: 'Schema not initialized',
        message: 'Run the Setup Wizard to initialize the database schema'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const currentVersion = result.rows[0].db_version || 0;
    console.log(`[UPDATE-SCHEMA] Current version: ${currentVersion}, Target: ${DB_VERSION}`);

    if (currentVersion >= DB_VERSION) {
      console.log('[UPDATE-SCHEMA] Schema already up to date');
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
        // No specific migration for this version, just increment
        console.log(`[UPDATE-SCHEMA] No migration defined for v${version}, skipping to v${version + 1}`);
        version += 1;

        console.log(`[UPDATE-SCHEMA] Updating db_version to ${version}...`);
        await client.query(
          'UPDATE public.app_settings SET db_version = $1, updated_at = now() WHERE id = $2',
          [version, 'app']
        );
        continue;
      }

      console.log(`[UPDATE-SCHEMA] Applying migration v${version} -> v${version + 1}`);
      await client.query(sql);

      version += 1;
      console.log(`[UPDATE-SCHEMA] Updating db_version to ${version}...`);
      await client.query(
        'UPDATE public.app_settings SET db_version = $1, updated_at = now() WHERE id = $2',
        [version, 'app']
      );
      console.log(`[UPDATE-SCHEMA] Migration v${version - 1} -> v${version} completed`);
    }

    await client.end();
    client = null;

    console.log('[UPDATE-SCHEMA] Schema update completed successfully');
    return new Response(JSON.stringify({ 
      message: 'Schema updated successfully',
      fromVersion: currentVersion,
      toVersion: version
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[UPDATE-SCHEMA] Error:', error.message, error.stack);
    if (client) {
      try {
        await client.end();
      } catch (e) {
        console.warn('[UPDATE-SCHEMA] Error closing client:', e);
      }
    }
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
