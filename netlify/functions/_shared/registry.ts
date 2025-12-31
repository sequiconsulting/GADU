import { getStore } from '@netlify/blobs';
import { LodgeConfig, Registry } from '../../../types/lodge';

const store = getStore('gadu-registry');

export async function loadRegistry(): Promise<Registry> {
  const data = await store.get('lodges');
  return data ? JSON.parse(data) : {};
}

export async function saveRegistry(registry: Registry): Promise<void> {
  await store.set('lodges', JSON.stringify(registry), {
    metadata: { lastUpdate: new Date().toISOString() }
  });
}

export async function logAuditEvent(event: string, data: any): Promise<void> {
  const auditStore = getStore('gadu-audit');
  const timestamp = new Date().toISOString();
  await auditStore.set(`${timestamp}-${event}`, JSON.stringify(data));
}
