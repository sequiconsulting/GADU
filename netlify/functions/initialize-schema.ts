import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logAuditEvent } from './shared/registry';

function extractPostgresUrl(supabaseUrl: string, serviceKey: string): string {
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) throw new Error('Invalid Supabase URL');
  const projectId = match[1];
  return `postgresql://postgres:${serviceKey}@db.${projectId}.supabase.co:5432/postgres`;
}

export default async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  
  try {
    const { supabaseUrl, supabaseServiceKey } = await request.json() as any;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing credentials' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[INITIALIZE-SCHEMA] Starting schema initialization...');

    // Read schema SQL
    const schemaPath = join(__dirname, '../../supabase-schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');

    // Connect to postgres via service key
    const dbUrl = extractPostgresUrl(supabaseUrl, supabaseServiceKey);
    const client = new Client({ connectionString: dbUrl });
    
    try {
      await client.connect();
      console.log('[INITIALIZE-SCHEMA] Connected to postgres');

      // Execute entire schema SQL
      await client.query(schemaSQL);
      console.log('[INITIALIZE-SCHEMA] Schema SQL executed successfully');

      await client.end();

      // Log audit event after successful connection close
      await logAuditEvent('schema_initialized', { supabaseUrl });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Schema initialized successfully'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error: any) {
      console.error('[INITIALIZE-SCHEMA] Error executing schema:', error);
      try {
        await client.end();
      } catch (e) {
        // Ignore error during cleanup
      }
      throw error;
    }
  } catch (error: any) {
    console.error('[INITIALIZE-SCHEMA] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
