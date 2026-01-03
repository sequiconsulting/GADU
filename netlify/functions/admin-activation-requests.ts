import { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { initNetlifyBlobs, loadRegistry, logAuditEvent } from './shared/registry';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' } as const;

type ActivationRequestStatus = 'pending' | 'completed' | 'cancelled';

interface ActivationRequestData {
  gdprAccepted: boolean;
  glriNumber: string;
  lodgeName: string;
  province: string;
  associationName: string;
  address: string;
  zipCode: string;
  city: string;
  taxCode: string;
}

interface ActivationRequestRecord {
  id: string;
  status: ActivationRequestStatus;
  createdAt: string;
  updatedAt: string;
  data: ActivationRequestData;
}

interface ActivationRequestIndexEntry {
  id: string;
  status: ActivationRequestStatus;
  createdAt: string;
  updatedAt: string;
  glriNumber: string;
  lodgeName: string;
  province: string;
  associationName: string;
}

interface ActivationRequestIndex {
  version: 1;
  updatedAt: string;
  requests: ActivationRequestIndexEntry[];
}

const STORE_NAME = 'gadu-activation-requests';
const INDEX_KEY = 'index.json';

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

function normalizeStatus(value: any): ActivationRequestStatus {
  if (value === 'completed' || value === 'cancelled' || value === 'pending') return value;
  return 'pending';
}

function validateEditableData(input: any): string | null {
  if (!input || typeof input !== 'object') return 'Dati non validi';
  const required = ['glriNumber', 'lodgeName', 'province', 'associationName', 'address', 'zipCode', 'city', 'taxCode'];
  for (const key of required) {
    const val = input[key];
    if (!val || String(val).trim().length === 0) return `Campo mancante: ${key}`;
  }
  if (!/^\d{1,10}$/.test(String(input.glriNumber).trim())) return 'Numero loggia non valido';
  if (!/^[A-Z]{2}$/.test(String(input.province).trim().toUpperCase())) return 'Provincia non valida';
  if (!/^\d{5}$/.test(String(input.zipCode).trim())) return 'CAP non valido';
  if (String(input.taxCode).trim().length !== 16) return 'Codice fiscale non valido (16 caratteri)';
  return null;
}

async function loadIndex(store: any): Promise<ActivationRequestIndex> {
  const existing = await store.get(INDEX_KEY, { type: 'text' });
  if (!existing) {
    return { version: 1, updatedAt: new Date().toISOString(), requests: [] };
  }
  try {
    const parsed = JSON.parse(existing);
    if (!parsed?.requests || !Array.isArray(parsed.requests)) {
      return { version: 1, updatedAt: new Date().toISOString(), requests: [] };
    }
    return parsed as ActivationRequestIndex;
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), requests: [] };
  }
}

async function saveIndex(store: any, index: ActivationRequestIndex): Promise<void> {
  await store.set(INDEX_KEY, JSON.stringify(index), {
    metadata: { updatedAt: index.updatedAt, version: String(index.version) },
  });
}

async function loadRequest(store: any, id: string): Promise<ActivationRequestRecord | null> {
  const text = await store.get(`requests/${id}.json`, { type: 'text' });
  if (!text) return null;
  return JSON.parse(text) as ActivationRequestRecord;
}

async function saveRequest(store: any, record: ActivationRequestRecord): Promise<void> {
  await store.set(`requests/${record.id}.json`, JSON.stringify(record), {
    metadata: {
      id: record.id,
      status: record.status,
      glriNumber: record.data.glriNumber,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
  });
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    requireAdminAuth(event);
    initNetlifyBlobs(event);

    const store = getStore(STORE_NAME);
    const body = event.body ? JSON.parse(event.body) : {};
    const action = body?.action || 'list';

    if (action === 'list') {
      const statusFilter = body?.status as ActivationRequestStatus | undefined;
      const index = await loadIndex(store);
      const list = statusFilter ? index.requests.filter(r => r.status === statusFilter) : index.requests;
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ success: true, requests: list, updatedAt: index.updatedAt }) };
    }

    if (action === 'get') {
      const id = String(body?.id || '').trim();
      if (!id) return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ success: false, error: 'Missing id' }) };
      const record = await loadRequest(store, id);
      if (!record) return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ success: false, error: 'Not found' }) };
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ success: true, request: record }) };
    }

    if (action === 'update') {
      const id = String(body?.id || '').trim();
      const data = body?.data;
      if (!id) return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ success: false, error: 'Missing id' }) };

      const validationError = validateEditableData(data);
      if (validationError) {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ success: false, error: validationError }) };
      }

      const record = await loadRequest(store, id);
      if (!record) return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ success: false, error: 'Not found' }) };

      // Non permettere modifiche se già completata/annullata
      if (record.status !== 'pending') {
        return { statusCode: 409, headers: jsonHeaders, body: JSON.stringify({ success: false, error: 'Richiesta non modificabile (non è pending)' }) };
      }

      const nextData: ActivationRequestData = {
        gdprAccepted: true,
        glriNumber: String(data.glriNumber).trim(),
        lodgeName: String(data.lodgeName).trim(),
        province: String(data.province).trim().toUpperCase(),
        associationName: String(data.associationName).trim(),
        address: String(data.address).trim(),
        zipCode: String(data.zipCode).trim(),
        city: String(data.city).trim(),
        taxCode: String(data.taxCode).trim().toUpperCase(),
      };

      // Verifica collisioni: se cambia glriNumber e già esiste nel registry, blocca
      const registry = await loadRegistry();
      if (registry[nextData.glriNumber] && registry[nextData.glriNumber].glriNumber !== record.data.glriNumber) {
        return { statusCode: 409, headers: jsonHeaders, body: JSON.stringify({ success: false, error: 'Loggia già esistente nel registry' }) };
      }

      record.data = nextData;
      record.updatedAt = new Date().toISOString();
      await saveRequest(store, record);

      const index = await loadIndex(store);
      index.requests = index.requests.map(r => {
        if (r.id !== id) return r;
        return {
          ...r,
          glriNumber: nextData.glriNumber,
          lodgeName: nextData.lodgeName,
          province: nextData.province,
          associationName: nextData.associationName,
          updatedAt: record.updatedAt,
        };
      });
      index.updatedAt = record.updatedAt;
      await saveIndex(store, index);

      try {
        await logAuditEvent('activation_request_updated', { id, glriNumber: nextData.glriNumber });
      } catch (auditError) {
        console.warn('[ADMIN-ACTIVATION] Audit log failed (non-critical):', auditError);
      }

      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ success: true, request: record }) };
    }

    if (action === 'setStatus') {
      const id = String(body?.id || '').trim();
      const status = normalizeStatus(body?.status);
      if (!id) return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ success: false, error: 'Missing id' }) };

      const record = await loadRequest(store, id);
      if (!record) return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ success: false, error: 'Not found' }) };

      record.status = status;
      record.updatedAt = new Date().toISOString();
      await saveRequest(store, record);

      const index = await loadIndex(store);
      index.requests = index.requests.map(r => (r.id === id ? { ...r, status, updatedAt: record.updatedAt } : r));
      index.updatedAt = record.updatedAt;
      await saveIndex(store, index);

      try {
        await logAuditEvent('activation_request_status_changed', { id, status, glriNumber: record.data.glriNumber });
      } catch (auditError) {
        console.warn('[ADMIN-ACTIVATION] Audit log failed (non-critical):', auditError);
      }

      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ success: true, request: record }) };
    }

    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ success: false, error: 'Azione non supportata' }) };
  } catch (error: any) {
    const statusCode = error?.statusCode || (error?.message === 'Unauthorized' ? 401 : 500);
    console.error('[ADMIN-ACTIVATION] Error:', error?.message || error);
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ success: false, error: error?.message || 'Errore server' }) };
  }
};
