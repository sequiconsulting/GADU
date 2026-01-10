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

function validatePayload(input: any): string | null {
  if (!input || typeof input !== 'object') return 'Payload non valido';
  if (input.gdprAccepted !== true) return 'Approvazione GDPR obbligatoria';

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

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    initNetlifyBlobs(event);

    const body = event.body ? JSON.parse(event.body) : {};
    const validationError = validatePayload(body);
    if (validationError) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ success: false, error: validationError }) };
    }

    const data: ActivationRequestData = {
      gdprAccepted: true,
      glriNumber: String(body.glriNumber).trim(),
      lodgeName: String(body.lodgeName).trim(),
      province: String(body.province).trim().toUpperCase(),
      associationName: String(body.associationName).trim(),
      address: String(body.address).trim(),
      zipCode: String(body.zipCode).trim(),
      city: String(body.city).trim(),
      taxCode: String(body.taxCode).trim().toUpperCase(),
    };

    const registry = await loadRegistry();
    if (registry[data.glriNumber]) {
      return { statusCode: 409, headers: jsonHeaders, body: JSON.stringify({ success: false, error: 'Loggia già esistente' }) };
    }

    const store = getStore(STORE_NAME);
    const index = await loadIndex(store);

    const existingPending = index.requests.find(r => r.glriNumber === data.glriNumber && r.status === 'pending');
    if (existingPending) {
      return { statusCode: 409, headers: jsonHeaders, body: JSON.stringify({ success: false, error: 'Richiesta già presente per questa loggia' }) };
    }

    const now = new Date().toISOString();
    const id = `${data.glriNumber}-${Date.now()}`;

    const record: ActivationRequestRecord = {
      id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      data,
    };

    await store.set(`requests/${id}.json`, JSON.stringify(record), {
      metadata: {
        id,
        status: record.status,
        glriNumber: data.glriNumber,
        createdAt: now,
        updatedAt: now,
      },
    });

    const entry: ActivationRequestIndexEntry = {
      id,
      status: record.status,
      createdAt: now,
      updatedAt: now,
      glriNumber: data.glriNumber,
      lodgeName: data.lodgeName,
      province: data.province,
      associationName: data.associationName,
    };

    index.requests = [entry, ...index.requests].slice(0, 1000);
    index.updatedAt = now;
    await saveIndex(store, index);

    try {
      await logAuditEvent('activation_request_submitted', { id, glriNumber: data.glriNumber });
    } catch (auditError) {
      console.warn('[SUBMIT-ACTIVATION] Audit log failed (non-critical):', auditError);
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ success: true, requestId: id }) };
  } catch (error: any) {
    console.error('[SUBMIT-ACTIVATION] Error:', error?.message || error);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ success: false, error: error?.message || 'Errore server' }) };
  }
};
