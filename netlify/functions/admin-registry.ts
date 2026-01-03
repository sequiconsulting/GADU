import { Handler } from '@netlify/functions';
import { initNetlifyBlobs, loadRegistry, saveRegistry, logAuditEvent } from './shared/registry';
import { LodgeConfig, Registry } from '../../types/lodge';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UpsertPayload extends Partial<LodgeConfig> {
  glriNumber: string;
}

function requireAuth(event: any) {
  const token = event.headers?.authorization?.replace('Bearer ', '').trim();
  const adminPassword = process.env.ADMIN_INTERFACE_PASSWORD;

  if (!adminPassword) {
    console.error('[ADMIN-REGISTRY] ADMIN_INTERFACE_PASSWORD non configurata');
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

function validateLodge(input: UpsertPayload): string | null {
  const required = ['glriNumber', 'lodgeName', 'supabaseUrl', 'supabaseAnonKey', 'supabaseServiceKey', 'databasePassword'];
  for (const key of required) {
    if (!(input as any)[key]) return `Campo mancante: ${key}`;
  }
  if (!/^https:\/\/.+\.supabase\.co$/.test(input.supabaseUrl!)) {
    return 'Supabase URL non valido';
  }
  return null;
}

export const handler: Handler = async (event, context) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' };
    }
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }
    requireAuth(event);

    initNetlifyBlobs(event);
    const { action = 'list', lodge } = event.body ? JSON.parse(event.body) : {} as { action?: string; lodge?: UpsertPayload; glriNumber?: string };

    if (action === 'list') {
      const registry = await loadRegistry();
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, registry }) };
    }

    if (action === 'delete') {
      const glriNumber = lodge?.glriNumber || lodge?.glriNumber;
      if (!glriNumber) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'glriNumber richiesto' }) };
      }
      const registry = await loadRegistry();
      delete registry[glriNumber];
      await saveRegistry(registry);
      try {
        await logAuditEvent('lodge_deleted_admin', { glriNumber });
      } catch (e) {
        console.error('[ADMIN-REGISTRY] Audit log failed:', e);
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, registry }) };
    }

    if (action === 'upsert') {
      const validationError = validateLodge(lodge || {} as any);
      if (validationError) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: validationError }) };
      }
      const registry: Registry = await loadRegistry();
      const glri = lodge!.glriNumber;
      const now = new Date();
      const existing = registry[glri];
      registry[glri] = {
        ...(existing || {}),
        ...lodge,
        glriNumber: glri,
        createdAt: existing?.createdAt || now,
        lastAccess: now,
        isActive: lodge?.isActive ?? existing?.isActive ?? true,
      } as LodgeConfig;
      await saveRegistry(registry);
      try {
        await logAuditEvent('lodge_upsert_admin', { glriNumber: glri });
      } catch (e) {
        console.error('[ADMIN-REGISTRY] Audit log failed:', e);
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, registry }) };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Azione non supportata' }) };
  } catch (error: any) {
    const statusCode = error?.statusCode || (error?.message === 'Unauthorized' ? 401 : 500);
    console.error('[ADMIN-REGISTRY] Error:', error?.message || error);
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: error?.message || 'Errore server' })
    };
  }
};
