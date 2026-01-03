import { Handler } from '@netlify/functions';
import { initNetlifyBlobs, loadRegistry, saveRegistry, logAuditEvent } from './shared/registry';
import { LodgeConfig, Registry } from '../../types/lodge';
import { createCipheriv, randomBytes } from 'crypto';
import { getStore } from '@netlify/blobs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UpsertPayload extends Partial<LodgeConfig> {
  glriNumber: string;
}

interface SetPrivateKeysPayload {
  kyberPrivate: string; // hex
  rsaPrivateB64: string; // base64(Pem)
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

function getOriginFromEvent(event: any): string | null {
  const headers = event?.headers || {};
  const proto = headers['x-forwarded-proto'] || headers['X-Forwarded-Proto'];
  const host = headers['x-forwarded-host'] || headers['X-Forwarded-Host'] || headers['host'] || headers['Host'];
  if (proto && host) return `${proto}://${host}`;
  return process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || null;
}

function encryptPrivateKeysForBlob(payload: SetPrivateKeysPayload, masterKeyHex: string) {
  const key = Buffer.from(masterKeyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('[QUANTUM] QUANTUM_MASTER_KEY deve essere 32 bytes (64 hex)');
  }

  if (!/^[0-9a-fA-F]+$/.test(payload.kyberPrivate) || payload.kyberPrivate.length < 100) {
    throw new Error('[QUANTUM] kyberPrivate non valido (hex)');
  }
  if (!payload.rsaPrivateB64 || payload.rsaPrivateB64.length < 100) {
    throw new Error('[QUANTUM] rsaPrivateB64 non valido');
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const plaintext = JSON.stringify({
    kyberPrivate: payload.kyberPrivate,
    rsaPrivateB64: payload.rsaPrivateB64,
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted,
  };
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
    const { action = 'list', lodge, keys } = event.body ? JSON.parse(event.body) : {} as { action?: string; lodge?: UpsertPayload; glriNumber?: string; keys?: SetPrivateKeysPayload };

    if (action === 'list') {
      const registry = await loadRegistry();
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, registry }) };
    }

    if (action === 'delete') {
      const glriNumber = lodge?.glriNumber;
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

    if (action === 'setPrivateKeys') {
      const masterKey = process.env.QUANTUM_MASTER_KEY;
      if (!masterKey) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'QUANTUM_MASTER_KEY non configurata' }) };
      }
      if (!keys?.kyberPrivate || !keys?.rsaPrivateB64) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Payload keys mancante' }) };
      }

      const encryptedKeys = encryptPrivateKeysForBlob(keys, masterKey);
      const keysStore = getStore('quantum-keys');
      await keysStore.set('private-keys', JSON.stringify(encryptedKeys), {
        metadata: { updatedAt: new Date().toISOString() },
      });

      try {
        await logAuditEvent('quantum_private_keys_updated_admin', { updatedAt: new Date().toISOString() });
      } catch (e) {
        console.error('[ADMIN-REGISTRY] Audit log failed:', e);
      }

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    }

    if (action === 'syncRegistryFromWellKnown') {
      const origin = getOriginFromEvent(event);
      if (!origin) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Impossibile determinare origin del sito' }) };
      }

      const url = `${origin}/.well-known/gadu-registry.blob`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: `Fetch fallita (${res.status}) da ${url}` }) };
      }

      const blobText = await res.text();
      if (!blobText || !blobText.startsWith('v2:')) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Blob .well-known non valido o non v2' }) };
      }

      const registryStore = getStore('gadu-registry');
      await registryStore.set('lodges', blobText, {
        metadata: {
          syncedFrom: '/.well-known/gadu-registry.blob',
          syncedAt: new Date().toISOString(),
        },
      });

      try {
        await logAuditEvent('registry_synced_from_well_known_admin', { url, at: new Date().toISOString() });
      } catch (e) {
        console.error('[ADMIN-REGISTRY] Audit log failed:', e);
      }

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
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
