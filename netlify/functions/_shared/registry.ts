import { getStore } from '@netlify/blobs';
import { LodgeConfig, Registry } from '../../../types/lodge';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Local development fallback - AWS_LAMBDA_FUNCTION_NAME is always present on Netlify Functions
const isLocalDev = !process.env.AWS_LAMBDA_FUNCTION_NAME;
const localRegistryPath = join(process.cwd(), '.netlify', 'registry.json');

// Encryption settings
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer | null {
  const key = process.env.REGISTRY_ENCRYPTION_KEY;
  if (!key) {
    console.log('[CRYPTO] No REGISTRY_ENCRYPTION_KEY env var found');
    return null;
  }
  const buffer = Buffer.from(key, 'hex');
  console.log(`[CRYPTO] Key loaded: ${buffer.length} bytes`);
  if (buffer.length !== 32) {
    console.error(`[CRYPTO] Invalid key length! Got ${buffer.length} bytes, need exactly 32`);
    return null;
  }
  return buffer;
}

function encryptData(text: string): string {
  const key = getEncryptionKey();
  if (!key) {
    // No encryption key - return plain text (dev mode)
    return text;
  }
  
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptData(encryptedText: string): string {
  const key = getEncryptionKey();
  if (!key) {
    // No encryption key - assume plain text (dev mode)
    return encryptedText;
  }
  
  // Check if data is encrypted (has the iv:authTag:data format)
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    // Not encrypted format - return as is (backwards compatibility)
    return encryptedText;
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

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
  
  // Production: try to use Netlify Blobs
  try {
    console.log('[REGISTRY] Loading registry from Netlify Blobs...');
    // getStore must be called inside handler execution context (lazy)
    const store = getStore('gadu-registry');
    const data = await store.get('lodges');
    
    if (!data) {
      console.log('[REGISTRY] No data found in Netlify Blobs, returning empty registry');
      return {};
    }
    
    console.log('[REGISTRY] Data retrieved from Blobs, decrypting...');
    // Convert ArrayBuffer to string if needed
    const encryptedString = typeof data === 'string' ? data : new TextDecoder().decode(data);
    const jsonString = decryptData(encryptedString);
    const registry = JSON.parse(jsonString);
    console.log(`[REGISTRY] Loaded registry with keys: ${Object.keys(registry).join(', ')}`);
    return registry;
  } catch (error: any) {
    // Blobs not configured - return empty registry (9999 will be auto-seeded)
    console.error('[REGISTRY] Error loading from Blobs:', error?.message || error);
    console.error('[REGISTRY] Stack:', error?.stack);
    return {};
  }
}

export async function saveRegistry(registry: Registry): Promise<void> {
  if (isLocalDev) {
    // Local file-based registry
    ensureLocalRegistryDir();
    writeFileSync(localRegistryPath, JSON.stringify(registry, null, 2), 'utf-8');
    return;
  }
  
  // Production: try to use Netlify Blobs
  try {
    const store = getStore('gadu-registry');
    const jsonString = JSON.stringify(registry);
    const encryptedData = encryptData(jsonString);
    await store.set('lodges', encryptedData, {
      metadata: { 
        lastUpdate: new Date().toISOString(),
        encrypted: !!getEncryptionKey()
      }
    });
    console.log('[BLOBS] Registry saved successfully');
  } catch (error: any) {
    // Blobs not configured - just log warning (9999 is in-memory only)
    console.error('[BLOBS] Failed to save registry:', {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      fullError: error
    });
  }
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
