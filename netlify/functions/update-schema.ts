import { loadRegistry } from './shared/registry';
import { Client } from 'pg';

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

    // Connect directly via postgres
    const dbUrl = extractPostgresUrl(lodge.supabaseUrl, lodge.supabaseServiceKey);
    const client = new Client({ connectionString: dbUrl });

    try {
      await client.connect();
      console.log('[UPDATE-SCHEMA] Connected to postgres');

      // Get current db_version
      const result = await client.query(
        'SELECT db_version FROM public.app_settings WHERE id = $1',
        ['app']
      );

      if (result.rows.length === 0) {
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

          await client.query(
            'UPDATE public.app_settings SET db_version = $1, updated_at = now() WHERE id = $2',
            [version, 'app']
          );
          continue;
        }

        console.log(`[UPDATE-SCHEMA] Applying migration v${version} -> v${version + 1}`);
        await client.query(sql);

        version += 1;
        await client.query(
          'UPDATE public.app_settings SET db_version = $1, updated_at = now() WHERE id = $2',
          [version, 'app']
        );
        console.log(`[UPDATE-SCHEMA] Migration v${version - 1} -> v${version} completed`);
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
      try {
        await client.end();
      } catch (e) {
        // Ignore error during cleanup
      }
      console.error('[UPDATE-SCHEMA] Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error: any) {
    console.error('[UPDATE-SCHEMA] Outer error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
