import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logAuditEvent } from './shared/registry';

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
      console.warn(`[INITIALIZE-SCHEMA] Connection attempt ${i + 1}/${maxRetries} failed:`, error.message);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

export default async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  
  let sql: any = null;

  try {
    const { supabaseUrl, databasePassword } = await request.json() as any;
    
    if (!supabaseUrl || !databasePassword) {
      return new Response(
        JSON.stringify({ error: 'Missing credentials' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[INITIALIZE-SCHEMA] Starting schema initialization...');

    // Read schema SQL from project root
    const schemaPath = join(process.cwd(), 'supabase-schema.sql');
    console.log('[INITIALIZE-SCHEMA] Reading schema from:', schemaPath);
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    console.log('[INITIALIZE-SCHEMA] Schema file loaded, size:', schemaSQL.length, 'bytes');

    // Connect to postgres via database password
    const dbUrl = extractPostgresUrl(supabaseUrl, databasePassword);
    console.log('[INITIALIZE-SCHEMA] Connecting to:', dbUrl.replace(databasePassword, '***'));
    
    sql = await connectWithRetry(dbUrl);
    console.log('[INITIALIZE-SCHEMA] Connected to postgres');

    // Execute entire schema SQL using unsafe for DDL
    await sql.unsafe(schemaSQL);
    console.log('[INITIALIZE-SCHEMA] Schema SQL executed successfully');

    await sql.end();
    sql = null;

    // Log audit event after successful connection close
    try {
      await logAuditEvent('schema_initialized', { supabaseUrl });
    } catch (auditError) {
      console.warn('[INITIALIZE-SCHEMA] Audit log failed (non-critical):', auditError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Schema initialized successfully'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[INITIALIZE-SCHEMA] Error:', error.message, error.stack);
    if (sql) {
      try {
        await sql.end();
      } catch (e) {
        console.warn('[INITIALIZE-SCHEMA] Error closing connection:', e);
      }
    }
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
