import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logAuditEvent } from './shared/registry';

function extractPostgresUrl(supabaseUrl: string, serviceKey: string): string {
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) throw new Error('Invalid Supabase URL');
  const projectId = match[1];
  // Use Supabase Connection Pooler (IPv4, serverless-friendly, port 6543)
  return `postgresql://postgres.${projectId}:${serviceKey}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
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
  
  let client: Client | null = null;

  try {
    const { supabaseUrl, supabaseServiceKey } = await request.json() as any;
    
    if (!supabaseUrl || !supabaseServiceKey) {
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

    // Connect to postgres via service key
    const dbUrl = extractPostgresUrl(supabaseUrl, supabaseServiceKey);
    console.log('[INITIALIZE-SCHEMA] Connecting to:', dbUrl.replace(supabaseServiceKey, '***'));
    
    client = await connectWithRetry(dbUrl);
    console.log('[INITIALIZE-SCHEMA] Connected to postgres');

    // Execute entire schema SQL
    await client.query(schemaSQL);
    console.log('[INITIALIZE-SCHEMA] Schema SQL executed successfully');

    await client.end();
    client = null;

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
    if (client) {
      try {
        await client.end();
      } catch (e) {
        console.warn('[INITIALIZE-SCHEMA] Error closing client:', e);
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
