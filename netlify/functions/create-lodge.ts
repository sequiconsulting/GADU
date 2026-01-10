import { Handler } from '@netlify/functions';
import dns from 'dns';
import { lookup as dnsLookup } from 'dns/promises';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { initNetlifyBlobs, loadRegistry, logAuditEvent, saveRegistry } from './shared/registry';
import { LodgeConfig, Registry } from '../../types/lodge';
import { createLodgeRequestSchema } from '../../schemas/netlify';
import { formatZodError } from '../../schemas/common';

// Forza IPv4 first per evitare ENETUNREACH su host IPv6 dei cluster Supabase
dns.setDefaultResultOrder('ipv4first');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function requireAdminAuth(event: any) {
  const token = event.headers?.authorization?.replace('Bearer ', '').trim();
  const adminPassword = process.env.ADMIN_INTERFACE_PASSWORD;

  if (!adminPassword) {
    const err: any = new Error('Admin password non configurata');
    err.statusCode = 500;
    throw err;
  }

  if (!token) {
    const err: any = new Error('Missing auth token');
    err.statusCode = 401;
    throw err;
  }

  if (token !== adminPassword) {
    const err: any = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
}

async function buildConnectionUrls(supabaseUrl: string, databasePassword: string): Promise<string[]> {
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) throw new Error('Invalid Supabase URL');
  const projectId = match[1];

  const host = `db.${projectId}.supabase.co`;
  let ipv4Host = host;
  try {
    const res = await dnsLookup(host, { family: 4 });
    ipv4Host = res.address;
    console.log('[CREATE-LODGE] Resolved IPv4 for', host, '->', ipv4Host);
  } catch (err: any) {
    console.warn('[CREATE-LODGE] DNS IPv4 lookup failed for', host, ':', err.message);
  }

  const direct = `postgresql://postgres:${databasePassword}@${ipv4Host}:5432/postgres`;
  const pooler = `postgresql://postgres.${projectId}:${databasePassword}@aws-1-eu-west-3.pooler.supabase.com:5432/postgres`;

  return [direct, pooler];
}

async function connectWithRetry(dbUrl: string, maxRetries: number = 3) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const sql = postgres(dbUrl, { max: 1 });
      await sql`SELECT 1`;
      return sql;
    } catch (error: any) {
      lastError = error;
      console.warn(`[CREATE-LODGE] Connection attempt ${i + 1}/${maxRetries} failed:`, error.message);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

async function preflightDatabaseConnection(supabaseUrl: string, databasePassword: string): Promise<void> {
  const urls = await buildConnectionUrls(supabaseUrl, databasePassword);
  let lastError: any;
  for (const url of urls) {
    try {
      console.log('[CREATE-LODGE] Preflight DB connection:', url.includes('pooler') ? 'pooler' : 'direct');
      const sql = await connectWithRetry(url, 2);
      await sql.end();
      console.log('[CREATE-LODGE] ✓ Preflight DB connection OK');
      return;
    } catch (err: any) {
      lastError = err;
      console.warn('[CREATE-LODGE] Preflight DB connection failed:', err?.message || err);
    }
  }
  throw lastError || new Error('Database connection preflight failed');
}

async function initializeSchema(glriNumber: string, databasePassword: string): Promise<void> {
  // Determina l'URL della funzione update-schema in modo robusto
  let url = process.env.UPDATE_SCHEMA_URL;
  if (!url) {
    // Se in ambiente Netlify, usa l'URL pubblico
    if (process.env.URL) {
      url = `${process.env.URL}/.netlify/functions/update-schema`;
    } else {
      // Fallback locale
      url = 'http://localhost:8888/.netlify/functions/update-schema';
    }
  }
  const res = await fetch(url, { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ glriNumber, databasePassword })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Errore update-schema: ${res.status} ${text}`);
  }
  const data = await res.json();
  if (typeof data === 'object' && data !== null && 'error' in data && (data as any).error) {
    throw new Error(`Errore update-schema: ${(data as any).error}`);
  }
}

async function upsertSecretaryUser(params: { supabaseUrl: string; supabaseServiceKey: string; email: string }) {
  const supabaseAdmin = createClient(params.supabaseUrl, params.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = params.email.trim().toLowerCase();
  const password = '123456789';

  const { data: createdData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: 'Segretario',
      privileges: ['AD'],
      mustChangePassword: true,
    },
  });

  if (!createErr) return { created: true, existed: false, userId: createdData?.user?.id };

  if (!createErr.message?.includes('already registered')) {
    throw createErr;
  }

  // Modalità B richiesta: se l'utente esiste già, prosegui senza modificare password/metadata.
  return { created: false, existed: true };
}

export const handler: Handler = async (event) => {
  let glriNumberForRollback: string | null = null;
  let userIdToRollback: string | undefined;
  let rollbackSupabaseUrl: string | undefined;
  let rollbackSupabaseServiceKey: string | undefined;

  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' };
    }
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    requireAdminAuth(event);
    initNetlifyBlobs(event);

    const body = event.body ? JSON.parse(event.body) : {};
    const parsedBody = createLodgeRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: formatZodError(parsedBody.error) }),
      };
    }

    const {
      glriNumber,
      lodgeName,
      province,
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceKey,
      databasePassword,
      secretaryEmail,
      associationName,
      address,
      zipCode,
      city,
      taxCode,
    } = parsedBody.data;

    rollbackSupabaseUrl = supabaseUrl;
    rollbackSupabaseServiceKey = supabaseServiceKey;

    const registry: Registry = await loadRegistry();
    if (registry[glriNumber]) {
      return { statusCode: 409, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Loggia già esistente' }) };
    }

    // Preflight: verifica credenziali DB prima di scrivere nel registry
    await preflightDatabaseConnection(supabaseUrl, databasePassword);

    const now = new Date();
    const lodgeConfig: LodgeConfig = {
      glriNumber,
      lodgeName,
      province,
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceKey,
      databasePassword,
      createdAt: now,
      lastAccess: now,
      // Stage 1: inserisci in registry come inattiva (verrà attivata a fine procedura)
      isActive: false,
      adminEmail: secretaryEmail,
      associationName,
      address,
      zipCode,
      city,
      taxCode,
    } as any;

    // Stage 1: salva la loggia nel registry (inattiva)
    registry[glriNumber] = lodgeConfig;
    await saveRegistry(registry);
    glriNumberForRollback = glriNumber;

    // Rileggi il registry per verificare che il save sia stato completato correttamente (single source of truth)
    console.log('[CREATE-LODGE] Verifying registry write for', glriNumber);
    const verifyRegistry = await loadRegistry();
    const savedLodge = verifyRegistry[glriNumber];
    if (!savedLodge) {
      throw new Error('Registry write verification failed: lodge not found after save');
    }
    if (!savedLodge.databasePassword) {
      throw new Error('Registry write verification failed: databasePassword missing');
    }
    console.log('[CREATE-LODGE] ✓ Registry write verified');

    console.log('[CREATE-LODGE] Initializing schema for', glriNumber);
    await initializeSchema(glriNumber, databasePassword);

    console.log('[CREATE-LODGE] Creating Segretario user for', glriNumber);
    const secretaryResult = await upsertSecretaryUser({ supabaseUrl, supabaseServiceKey, email: secretaryEmail });

    if (secretaryResult?.created && secretaryResult.userId) {
      userIdToRollback = secretaryResult.userId;
    }

    // Stage 3: attiva loggia nel registry (commit finale)
    const committedRegistry: Registry = await loadRegistry();
    if (committedRegistry[glriNumber]) {
      committedRegistry[glriNumber] = {
        ...committedRegistry[glriNumber],
        isActive: true,
        lastAccess: new Date(),
      } as any;
      await saveRegistry(committedRegistry);
    }

    try {
      await logAuditEvent('lodge_created', { glriNumber, secretaryEmail, secretaryResult });
    } catch (auditError) {
      console.warn('[CREATE-LODGE] Audit log failed (non-critical):', auditError);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, glriNumber, secretaryResult }),
    };
  } catch (error: any) {
    // Rollback best-effort: rimuovi la loggia dal registry se l'abbiamo inserita.
    if (glriNumberForRollback) {
      try {
        const registry: Registry = await loadRegistry();
        if (registry[glriNumberForRollback]) {
          delete registry[glriNumberForRollback];
          await saveRegistry(registry);
          console.warn('[CREATE-LODGE] Rollback registry completed for', glriNumberForRollback);
        }
      } catch (rollbackErr: any) {
        console.error('[CREATE-LODGE] Rollback registry failed:', rollbackErr?.message || rollbackErr);
      }
    }

    // Rollback best-effort: se abbiamo creato l'utente in questa procedura, prova a cancellarlo.
    if (userIdToRollback) {
      try {
        if (rollbackSupabaseUrl && rollbackSupabaseServiceKey) {
          const supabaseAdmin = createClient(rollbackSupabaseUrl, rollbackSupabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          await supabaseAdmin.auth.admin.deleteUser(userIdToRollback);
          console.warn('[CREATE-LODGE] Rollback user completed for', userIdToRollback);
        }
      } catch (rollbackErr: any) {
        console.warn('[CREATE-LODGE] Rollback user failed (non-critical):', rollbackErr?.message || rollbackErr);
      }
    }

    const statusCode = error?.statusCode || (error?.message === 'Unauthorized' ? 401 : 500);

    let userFriendlyError = error?.message || 'Errore server';
    if (error?.message?.includes('ENETUNREACH')) {
      userFriendlyError = 'Connessione al database non raggiungibile (IPv6). Riprova: la risoluzione forzata IPv4 è già attiva, controlla la connettività di rete.';
    } else if (error?.message?.includes('Tenant or user not found')) {
      userFriendlyError = 'Credenziali database non valide. Verifica URL Supabase e Database Password.';
    } else if (error?.message?.includes('password authentication failed')) {
      userFriendlyError = 'Password del database non corretta. Controlla in Settings → Database → Database Password.';
    } else if (error?.message?.includes('timeout')) {
      userFriendlyError = 'Timeout di connessione. Il progetto Supabase potrebbe essere in pausa o non raggiungibile.';
    }

    console.error('[CREATE-LODGE] Error:', error?.message || error);
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: userFriendlyError, technicalDetails: error?.message }),
    };
  }
};
