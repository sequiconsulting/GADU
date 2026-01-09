import { connectLambda, getStore } from '@netlify/blobs';
import { Registry } from '../../../types/lodge';
import { createCipheriv, createDecipheriv, randomBytes, publicEncrypt, privateDecrypt, createPrivateKey } from 'crypto';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

let blobsInitialized = false;

function tryReadJson(filePath: string): any | null {
  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isLocalDev(): boolean {
  return process.env.NETLIFY_DEV === 'true';
}

function getProjectNetlifyDir(): string {
  const base = process.env.NETLIFY_BASE || process.cwd();
  return join(base, '.netlify');
}

function getLocalRegistryPath(): string {
  return join(getProjectNetlifyDir(), 'registry.json');
}

function loadRegistryFromLocalFileOrThrow(): Registry {
  const filePath = getLocalRegistryPath();
  const json = tryReadJson(filePath);
  if (!json) {
    throw new Error(
      `[REGISTRY] File locale non leggibile o non valido: ${filePath}. ` +
        'Esegui "netlify link" e assicurati che .netlify/registry.json esista e sia JSON valido.'
    );
  }
  return json as Registry;
}

function saveRegistryToLocalFileOrThrow(registry: Registry): void {
  const filePath = getLocalRegistryPath();
  try {
    writeFileSync(filePath, JSON.stringify(registry, null, 2), 'utf8');
  } catch (e: any) {
    throw new Error(`[REGISTRY] Impossibile scrivere il file locale ${filePath}: ${e?.message || e}`);
  }
}

function normalizeHeaders(headers: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;
    out[String(key).toLowerCase()] = Array.isArray(value) ? String(value[0]) : String(value);
  }
  return out;
}

// In Netlify runtime, Blobs context is provided per-request via event.blobs.
// We must call connectLambda(event) before using getStore().
export function initNetlifyBlobs(event: any): void {
  if (blobsInitialized) return;

  // Local dev: non usiamo Blobs (registry su file locale)
  if (isLocalDev()) {
    blobsInitialized = true;
    return;
  }

  // 1) Prefer per-request context (runtime Netlify)
  const blobs = event?.blobs;
  if (blobs) {
    connectLambda({ blobs, headers: normalizeHeaders(event?.headers) } as any);
    blobsInitialized = true;
    return;
  }

  // 2) If Netlify injected a global/env context, use it.
  const hasEnvContext = Boolean(process.env.NETLIFY_BLOBS_CONTEXT) || Boolean((globalThis as any).netlifyBlobsContext);
  if (hasEnvContext) {
    blobsInitialized = true;
    return;
  }

  throw new Error(
    'Netlify Blobs non configurato in locale. Impossibile accedere al registry. ' +
      'Atteso event.blobs (runtime Netlify) oppure NETLIFY_BLOBS_CONTEXT (prod).'
  );
}

function getBlobStore(name: string) {
  return getStore(name);
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const AES_KEY_LENGTH = 32;

interface QuantumKeys {
  kyber: {
    publicKey: string;
    privateKey: string;
  };
  rsa: {
    publicKey: string;
    privateKey: string;
  };
}

async function getQuantumKeys(): Promise<QuantumKeys | null> {
  const kyberPubKey = process.env.KYBER_PUBLIC_KEY;
  const rsaPubKeyB64 = process.env.RSA_PUBLIC_KEY_B64;
  const masterKey = process.env.QUANTUM_MASTER_KEY;
  
  if (!kyberPubKey || !rsaPubKeyB64 || !masterKey) {
    throw new Error('[QUANTUM] Missing keys in env');
  }
  
  let kyberPrivKey: string;
  let rsaPrivKeyB64: string;
  
  try {
    const keysStore = getBlobStore('quantum-keys');
    const encryptedKeysJson = await keysStore.get('private-keys', { type: 'text' });

    if (!encryptedKeysJson) {
      throw new Error('[QUANTUM] Private keys not found in Blobs');
    }
    
    const encryptedData = JSON.parse(encryptedKeysJson);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const encrypted = encryptedData.data;
    
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(masterKey, 'hex'), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    
    const privateKeys = JSON.parse(decrypted);
    kyberPrivKey = privateKeys.kyberPrivate;
    rsaPrivKeyB64 = privateKeys.rsaPrivateB64;
    
    if (!kyberPrivKey || !rsaPrivKeyB64) {
      throw new Error('[QUANTUM] Invalid private keys format in Blobs');
    }
  } catch (error) {
    console.error('[QUANTUM] Error loading/decrypting private keys from Blobs:', error);
    throw error;
  }
  
  const rsaPubKey = Buffer.from(rsaPubKeyB64, 'base64').toString('utf-8');
  const rsaPrivKey = Buffer.from(rsaPrivKeyB64, 'base64').toString('utf-8');
  
  return {
    kyber: {
      publicKey: kyberPubKey,
      privateKey: kyberPrivKey
    },
    rsa: {
      publicKey: rsaPubKey,
      privateKey: rsaPrivKey
    }
  };
}

async function encryptData(text: string): Promise<string> {
  const quantumKeys = await getQuantumKeys();
  if (!quantumKeys) {
    throw new Error('Quantum keys not available for encryption');
  }
  
  try {
    const aesKey = randomBytes(AES_KEY_LENGTH);
    
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, aesKey, iv);
    let encryptedData = cipher.update(text, 'utf8', 'hex');
    encryptedData += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    const kyberPublicKey = Buffer.from(quantumKeys.kyber.publicKey, 'hex');
    const { cipherText: kyberCiphertext, sharedSecret } = ml_kem768.encapsulate(kyberPublicKey);
    
    const protectedKey = Buffer.alloc(AES_KEY_LENGTH);
    for (let i = 0; i < AES_KEY_LENGTH; i++) {
      protectedKey[i] = aesKey[i] ^ sharedSecret[i];
    }
    
    const rsaEncryptedKey = publicEncrypt(
      {
        key: quantumKeys.rsa.publicKey,
        padding: 1
      },
      protectedKey
    );
    
    const kyberCiphertextHex = Buffer.from(kyberCiphertext).toString('hex');

    return `v2:${kyberCiphertextHex}:${rsaEncryptedKey.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedData}`;
  } catch (error: any) {
    console.error('[CRYPTO] Quantum encryption failed:', error.message);
    throw new Error(`Quantum encryption failed: ${error.message}`);
  }
}

async function decryptData(encryptedText: string): Promise<string> {
  if (!encryptedText.startsWith('v2:')) {
    throw new Error(`Unsupported encryption format. Expected v2 but got: ${encryptedText.substring(0, 30)}`);
  }
  
  const parts = encryptedText.split(':');
  if (parts.length !== 6) {
    throw new Error(`Invalid v2 format. Expected 6 parts but got ${parts.length}`);
  }
  
  const quantumKeys = await getQuantumKeys();
  if (!quantumKeys) {
    throw new Error('Quantum keys not available for decryption');
  }

  // Diagnostica non sensibile: lunghezze payload vs chiave RSA
  // (utile per identificare mismatch chiavi/payload corrotto)
  const partsForDiag = encryptedText.split(':');
  const rsaCiphertextHexLen = partsForDiag?.[2]?.length || 0;
  const rsaCiphertextBytes = Math.floor(rsaCiphertextHexLen / 2);
  try {
    const keyObj = createPrivateKey(quantumKeys.rsa.privateKey);
    const details: any = (keyObj as any).asymmetricKeyDetails;
    const modulusBits = details?.modulusLength;
    const modulusBytes = typeof modulusBits === 'number' ? Math.floor(modulusBits / 8) : undefined;
    if (modulusBytes) {
      console.log('[CRYPTO][DIAG] RSA modulus bytes:', modulusBytes, 'rsaCiphertextBytes:', rsaCiphertextBytes);
    } else {
      console.log('[CRYPTO][DIAG] RSA details non disponibili; rsaCiphertextBytes:', rsaCiphertextBytes);
    }
  } catch (e: any) {
    console.log('[CRYPTO][DIAG] Impossibile leggere dettagli chiave RSA:', e?.message);
  }
  
  try {
    const [version, kyberCiphertextHex, rsaEncryptedKeyHex, ivHex, authTagHex, encryptedData] = parts;
    
    const rsaEncryptedKey = Buffer.from(rsaEncryptedKeyHex, 'hex');
    const protectedKey = privateDecrypt(
      {
        key: quantumKeys.rsa.privateKey,
        padding: 1
      },
      rsaEncryptedKey
    );
    
    const kyberCiphertext = Buffer.from(kyberCiphertextHex, 'hex');
    const kyberPrivateKey = Buffer.from(quantumKeys.kyber.privateKey, 'hex');
    const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, kyberPrivateKey);
    
    const aesKey = Buffer.alloc(AES_KEY_LENGTH);
    for (let i = 0; i < AES_KEY_LENGTH; i++) {
      aesKey[i] = protectedKey[i] ^ sharedSecret[i];
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = createDecipheriv(ALGORITHM, aesKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    console.error('[CRYPTO] Quantum decryption failed:', error?.message);
    throw new Error(`Quantum decryption failed: ${error?.message}`);
  }
}

export async function loadRegistry(): Promise<Registry> {
  try {
    if (isLocalDev()) {
      return loadRegistryFromLocalFileOrThrow();
    }

    const store = getBlobStore('gadu-registry');
    const data = await store.get('lodges');

    if (!data) {
      throw new Error('[REGISTRY] Registry non inizializzato: key gadu-registry/lodges assente');
    }

    const encryptedString = typeof data === 'string' ? data : new TextDecoder().decode(data);
    const jsonString = await decryptData(encryptedString);
    return JSON.parse(jsonString);
  } catch (error: any) {
    console.error('[REGISTRY] Error loading from Blobs:', error?.message || error);
    throw error;
  }
}

export async function saveRegistry(registry: Registry): Promise<void> {
  try {
    if (isLocalDev()) {
      saveRegistryToLocalFileOrThrow(registry);
      return;
    }

    const store = getBlobStore('gadu-registry');
    const jsonString = JSON.stringify(registry);
    const encryptedData = await encryptData(jsonString);
    await store.set('lodges', encryptedData, {
      metadata: {
        lastUpdate: new Date().toISOString(),
        encrypted: 'quantum-hybrid',
        lodgeCount: Object.keys(registry).length,
      },
    });
  } catch (error: any) {
    console.error('[BLOBS] Failed to save registry:', error?.message || error);
    throw error;
  }
}

export async function logAuditEvent(event: string, data: any): Promise<void> {
  console.log(`[AUDIT] ${event}:`, data);
  
  try {
    if (isLocalDev()) {
      const filePath = join(getProjectNetlifyDir(), 'audit.log');
      const line = JSON.stringify({ at: new Date().toISOString(), event, data }) + '\n';
      writeFileSync(filePath, line, { encoding: 'utf8', flag: 'a' });
      return;
    }

    const auditStore = getBlobStore('gadu-audit');
    const timestamp = new Date().toISOString();
    await auditStore.set(`${timestamp}-${event}`, JSON.stringify(data));
  } catch (error: any) {
    console.error('[AUDIT] Failed to save audit log to Blobs:', error?.message);
    throw error;
  }
}
