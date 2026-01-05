import { Handler } from '@netlify/functions';
import dns from 'dns';
import { lookup as dnsLookup } from 'dns/promises';
import postgres from 'postgres';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { initNetlifyBlobs, loadRegistry, logAuditEvent, saveRegistry } from './shared/registry';
import { LodgeConfig, Registry } from '../../types/lodge';

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

function validatePayload(input: any): string | null {
  const required = ['glriNumber', 'lodgeName', 'province', 'supabaseUrl', 'supabaseAnonKey', 'supabaseServiceKey', 'databasePassword', 'secretaryEmail'];
  for (const key of required) {
    if (!input?.[key]) return `Campo mancante: ${key}`;
  }
  if (!/^https:\/\/.+\.supabase\.co$/.test(input.supabaseUrl)) {
    return 'Supabase URL non valido';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input.secretaryEmail)) {
    return 'Email Segretario non valida';
  }
  return null;
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

async function initializeSchema(supabaseUrl: string, databasePassword: string, glriNumber: string): Promise<void> {
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
  const params = new URLSearchParams({ glriNumber });
  const fullUrl = `${url}?${params.toString()}`;
  const res = await fetch(fullUrl, { method: 'GET' });
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

  const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: 'Segretario',
      privileges: ['AD'],
      mustChangePassword: true,
    },
  });

  if (!createErr) return { created: true, updated: false };

  if (!createErr.message?.includes('already registered')) {
    throw createErr;
  }

  const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) throw listErr;

  const existing = (usersData as any)?.users?.find((u: any) => (u.email || '').toLowerCase() === email);
  if (!existing) {
    throw new Error('Utente esiste ma non trovato in listUsers');
  }

  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
    password,
    user_metadata: {
      ...(existing.user_metadata || {}),
      name: 'Segretario',
      privileges: ['AD'],
      mustChangePassword: true,
    },
  });
  if (updateErr) throw updateErr;

  return { created: false, updated: true };
}

export const handler: Handler = async (event) => {
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
    const validationError = validatePayload(body);
    if (validationError) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: validationError }) };
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
    } = body as any;

    const registry: Registry = await loadRegistry();
    if (registry[glriNumber]) {
      return { statusCode: 409, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Loggia già esistente' }) };
    }

    console.log('[CREATE-LODGE] Initializing schema for', glriNumber);
    await initializeSchema(supabaseUrl, databasePassword, glriNumber);

    console.log('[CREATE-LODGE] Creating Segretario user for', glriNumber);
    const secretaryResult = await upsertSecretaryUser({ supabaseUrl, supabaseServiceKey, email: secretaryEmail });

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
      isActive: true,
      adminEmail: secretaryEmail,
      associationName,
      address,
      zipCode,
      city,
      taxCode,
    } as any;

    registry[glriNumber] = lodgeConfig;
    await saveRegistry(registry);

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
