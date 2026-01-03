import { Handler } from '@netlify/functions';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';
import dns from 'dns';
import { lookup as dnsLookup } from 'dns/promises';
import { initNetlifyBlobs, logAuditEvent } from './shared/registry';

// Forza IPv4 first per evitare ENETUNREACH su host IPv6 dei cluster Supabase
dns.setDefaultResultOrder('ipv4first');

// Costruisce una lista di URL di connessione Postgres per Supabase.
// Prova prima la connessione diretta (db.<project>.supabase.co) risolvendo IPv4, poi un fallback su pooler.
async function buildConnectionUrls(supabaseUrl: string, databasePassword: string): Promise<string[]> {
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) throw new Error('Invalid Supabase URL');
  const projectId = match[1];

  const host = `db.${projectId}.supabase.co`;
  let ipv4Host = host;
  try {
    const res = await dnsLookup(host, { family: 4 });
    ipv4Host = res.address;
    console.log('[INITIALIZE-SCHEMA] Resolved IPv4 for', host, '->', ipv4Host);
  } catch (err: any) {
    console.warn('[INITIALIZE-SCHEMA] DNS IPv4 lookup failed for', host, ':', err.message);
  }

  // Connessione diretta (raccomandata per DDL): user postgres, host IPv4 se disponibile
  const direct = `postgresql://postgres:${databasePassword}@${ipv4Host}:5432/postgres`;

  // Fallback: pooler session mode. Region non deducibile dall'URL; usiamo eu-west-3 che è quella del progetto GADU.
  const pooler = `postgresql://postgres.${projectId}:${databasePassword}@aws-1-eu-west-3.pooler.supabase.com:5432/postgres`;

  return [direct, pooler];
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

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  let sql: any = null;

  try {
    initNetlifyBlobs(event);
    const { supabaseUrl, databasePassword } = (event.body ? JSON.parse(event.body) : {}) as any;
    
    if (!supabaseUrl || !databasePassword) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing credentials' })
      };
    }

    console.log('[INITIALIZE-SCHEMA] Starting schema initialization...');

    // Read schema SQL from project root
    const schemaPath = join(process.cwd(), 'supabase-schema.sql');
    console.log('[INITIALIZE-SCHEMA] Reading schema from:', schemaPath);
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    console.log('[INITIALIZE-SCHEMA] Schema file loaded, size:', schemaSQL.length, 'bytes');

    // Connect to postgres via database password, provando più URL se necessario
    const dbUrls = await buildConnectionUrls(supabaseUrl, databasePassword);
    let lastError: any = null;
    for (const dbUrl of dbUrls) {
      try {
        console.log('[INITIALIZE-SCHEMA] Connecting to:', dbUrl.replace(databasePassword, '***'));
        sql = await connectWithRetry(dbUrl);
        console.log('[INITIALIZE-SCHEMA] Connected to postgres');
        break;
      } catch (connErr: any) {
        lastError = connErr;
        console.warn('[INITIALIZE-SCHEMA] Connection failed with URL:', connErr.message);
      }
    }

    if (!sql) {
      throw lastError || new Error('Unable to connect to Supabase Postgres');
    }

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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Schema initialized successfully'
      })
    };

  } catch (error: any) {
    console.error('[INITIALIZE-SCHEMA] Error:', error.message, error.stack);
    if (sql) {
      try {
        await sql.end();
      } catch (e) {
        console.warn('[INITIALIZE-SCHEMA] Error closing connection:', e);
      }
    }
    
    // Provide helpful error messages for common issues
    let userFriendlyError = error.message;
    if (error.message?.includes('ENETUNREACH')) {
      userFriendlyError = 'Connessione al database non raggiungibile (IPv6). Riprova: la risoluzione forzata IPv4 è già attiva, controlla la connettività di rete.';
    } else if (error.message?.includes('Tenant or user not found')) {
      userFriendlyError = 'Credenziali database non valide. Verifica che:\n' +
        '1. Il progetto Supabase esista e sia attivo\n' +
        '2. La Database Password sia corretta (Settings → Database → Database Password)\n' +
        '3. L\'URL Supabase corrisponda al progetto (formato: https://xxx.supabase.co)';
    } else if (error.message?.includes('password authentication failed')) {
      userFriendlyError = 'Password del database non corretta. Controlla in Settings → Database → Database Password';
    } else if (error.message?.includes('timeout')) {
      userFriendlyError = 'Timeout di connessione. Il progetto Supabase potrebbe essere in pausa o non raggiungibile.';
    }
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: userFriendlyError,
        technicalDetails: error.message
      })
    };
  }
};
