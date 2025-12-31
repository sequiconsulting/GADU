import { getStore } from '@netlify/blobs';
import { LodgeConfig, Registry } from '../../../types/lodge';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Local development fallback
const isLocalDev = !process.env.NETLIFY;
const localRegistryPath = join(process.cwd(), '.netlify', 'registry.json');

function ensureLocalRegistryDir() {
  const dir = join(process.cwd(), '.netlify');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export async function loadRegistry(): Promise<Registry> {
  if (isLocalDev) {
    // Local file-based registry
    ensureLocalRegistryDir();
    if (existsSync(localRegistryPath)) {
      const data = readFileSync(localRegistryPath, 'utf-8');
      return JSON.parse(data);
    }
    return {};
  }
  
  // Production: use Netlify Blobs
  const store = getStore('gadu-registry');
  const data = await store.get('lodges');
  return data ? JSON.parse(data) : {};
}

export async function saveRegistry(registry: Registry): Promise<void> {
  if (isLocalDev) {
    // Local file-based registry
    ensureLocalRegistryDir();
    writeFileSync(localRegistryPath, JSON.stringify(registry, null, 2), 'utf-8');
    return;
  }
  
  // Production: use Netlify Blobs
  const store = getStore('gadu-registry');
  await store.set('lodges', JSON.stringify(registry), {
    metadata: { lastUpdate: new Date().toISOString() }
  });
}

export async function logAuditEvent(event: string, data: any): Promise<void> {
  if (isLocalDev) {
    // Local: just console.log
    console.log(`[AUDIT] ${event}:`, data);
    return;
  }
  
  // Production: use Netlify Blobs
  const auditStore = getStore('gadu-audit');
  const timestamp = new Date().toISOString();
  await auditStore.set(`${timestamp}-${event}`, JSON.stringify(data));
}
