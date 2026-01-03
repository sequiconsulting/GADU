import { Handler } from '@netlify/functions';
import { initNetlifyBlobs, loadRegistry } from './shared/registry';
import postgres from 'postgres';
import { join } from 'path';

const DB_VERSION = 14;

// Database schema migrations (incremental changes only, not baseline)
const DB_MIGRATIONS: Record<number, string> = {
  // Esempio di migrazione no-op ma idempotente per verificare il flusso v13 -> v14
  13: `
    ALTER TABLE public.app_settings
      ALTER COLUMN updated_at SET DEFAULT now();
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
    const glriNumber =
      event.queryStringParameters?.glriNumber || event.queryStringParameters?.number;

    if (!glriNumber) {
      return {
        statusCode: 400,
        body: 'Missing glriNumber parameter'
      };
    }
    
    console.log(`[UPDATE-SCHEMA] Loading registry for lodge ${glriNumber}`);
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

    console.log(`[UPDATE-SCHEMA] Starting schema update for lodge ${glriNumber}`);

    // Connect directly via postgres
    const dbUrl = extractPostgresUrl(lodge.supabaseUrl, lodge.databasePassword);
    console.log('[UPDATE-SCHEMA] Connecting to postgres...');
    sql = await connectWithRetry(dbUrl);
    console.log('[UPDATE-SCHEMA] Connected to postgres');

    // Get current db_version
    console.log('[UPDATE-SCHEMA] Reading current db_version...');
    const result = await sql`
      SELECT db_version FROM public.app_settings WHERE id = 'app'
    `;

    if (result.length === 0) {
      console.warn('[UPDATE-SCHEMA] Schema not initialized - app_settings not found');
      await sql.end();
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Schema not initialized',
          message: 'Run the Setup Wizard to initialize the database schema'
        })
      };
    }

    const currentVersion = result[0].db_version || 0;
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
