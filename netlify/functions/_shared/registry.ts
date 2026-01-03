import { getStore } from '@netlify/blobs';
import { LodgeConfig, Registry } from '../../../types/lodge';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createCipheriv, createDecipheriv, randomBytes, publicEncrypt, privateDecrypt } from 'crypto';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

// Local development fallback: consider dev only when NETLIFY_DEV is explicitly true.
// On production functions (where NETLIFY_DEV is undefined/false) we must use Blobs,
// otherwise we'd try to write to /var/task/.netlify and get ENOENT/EPERM.
const isLocalDev = process.env.NETLIFY_DEV === 'true';
const localRegistryPath = join(process.cwd(), '.netlify', 'registry.json');
const localQuantumKeysPath = join(process.cwd(), '.netlify', 'quantum-keys.json');

// Encryption settings
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const AES_KEY_LENGTH = 32; // 256 bits

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

function getQuantumKeys(): QuantumKeys | null {
  // In local dev, load from file
  if (isLocalDev) {
    if (existsSync(localQuantumKeysPath)) {
      const data = readFileSync(localQuantumKeysPath, 'utf-8');
      return JSON.parse(data);
    }
    console.log('[QUANTUM] No local quantum keys found - encryption disabled in dev');
    return null;
  }
  
  // In production, load ALL keys from env vars
  const kyberPubKey = process.env.KYBER_PUBLIC_KEY;
  const kyberPrivKey = process.env.KYBER_PRIVATE_KEY;
  const rsaPubKeyB64 = process.env.RSA_PUBLIC_KEY_B64;
  const rsaPrivKeyB64 = process.env.RSA_PRIVATE_KEY_B64;
  
  if (!kyberPubKey || !kyberPrivKey || !rsaPubKeyB64 || !rsaPrivKeyB64) {
    console.log('[QUANTUM] Missing quantum keys in env - encryption disabled');
    console.log(`[QUANTUM] Available: kyberPub=${!!kyberPubKey}, kyberPriv=${!!kyberPrivKey}, rsaPubB64=${!!rsaPubKeyB64}, rsaPrivB64=${!!rsaPrivKeyB64}`);
    return null;
  }
  
  // Decode RSA keys from base64
  const rsaPubKey = Buffer.from(rsaPubKeyB64, 'base64').toString('utf-8');
  const rsaPrivKey = Buffer.from(rsaPrivKeyB64, 'base64').toString('utf-8');
  
  console.log('[QUANTUM] ✓ All quantum keys loaded from env (RSA decoded from base64)');
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

/**
 * Quantum-resistant hybrid encryption: Kyber + RSA + AES
 * 
 * Flow:
 * 1. Generate random AES-256 key
 * 2. Encrypt data with AES-GCM
 * 3. Encapsulate AES key with Kyber-768 (post-quantum)
 * 4. Encrypt Kyber ciphertext with RSA-4096 (classical)
 * 5. Return: rsa_encrypted_kyber_ciphertext:iv:authTag:aes_encrypted_data
 */
function encryptData(text: string): string {
  // In local dev with NETLIFY_DEV, skip encryption
  if (isLocalDev) {
    console.log('[CRYPTO] Local dev mode - skipping encryption');
    return text;
  }
  
  const quantumKeys = getQuantumKeys();
  if (!quantumKeys) {
    // No quantum keys - fallback to legacy AES if available
    const legacyKey = getEncryptionKey();
    if (!legacyKey) {
      console.warn('[CRYPTO] No encryption keys available - storing plaintext');
      return text;
    }
    return encryptDataLegacy(text, legacyKey);
  }
  
  try {
    // Step 1: Generate random AES key for this encryption
    const aesKey = randomBytes(AES_KEY_LENGTH);
    
    // Step 2: Encrypt data with AES-GCM
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, aesKey, iv);
    let encryptedData = cipher.update(text, 'utf8', 'hex');
    encryptedData += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    // Step 3: Encapsulate AES key with ML-KEM-768 (Kyber)
    const kyberPublicKey = Buffer.from(quantumKeys.kyber.publicKey, 'hex');
    const { cipherText: kyberCiphertext, sharedSecret } = ml_kem768.encapsulate(kyberPublicKey);
    
    // XOR AES key with Kyber shared secret (first 32 bytes)
    const protectedKey = Buffer.alloc(AES_KEY_LENGTH);
    for (let i = 0; i < AES_KEY_LENGTH; i++) {
      protectedKey[i] = aesKey[i] ^ sharedSecret[i];
    }
    
    // Step 4: Encrypt only the protected key (32 bytes) with RSA-4096
    // (Kyber ciphertext is too large for RSA - store it separately)
    const rsaEncrypted = publicEncrypt(
      {
        key: quantumKeys.rsa.publicKey,
        padding: 1 // PKCS1_OAEP_PADDING
      },
      protectedKey // Only 32 bytes
    );
    
    // Format: v2:kyberCiphertext:rsaEncryptedKey:iv:authTag:aes_data
    return `v2:${Buffer.from(kyberCiphertext).toString('hex')}:${rsaEncrypted.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedData}`;
  } catch (error: any) {
    console.error('[CRYPTO] Quantum encryption failed:', error.message);
    throw new Error(`Quantum encryption failed: ${error.message}`);
  }
}

/**
 * Legacy AES-only encryption (backward compatibility)
 */
function encryptDataLegacy(text: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData
  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Quantum-resistant hybrid decryption: RSA + Kyber + AES
 */
function decryptData(encryptedText: string): string {
  // In local dev, data is plaintext
  if (isLocalDev) {
    return encryptedText;
  }
  
  // Check format version
  const parts = encryptedText.split(':');
  
  // v2 format: v2:kyberCiphertext:rsaEncryptedKey:iv:authTag:aes_data (6 parts)
  if (parts[0] === 'v2' && parts.length === 6) {
    return decryptDataQuantum(encryptedText);
  }
  
  // v1 format: v1:iv:authTag:data (legacy AES)
  if (parts[0] === 'v1' && parts.length === 4) {
    return decryptDataLegacy(encryptedText);
  }
  
  // Old format without version (3 parts): iv:authTag:data
  if (parts.length === 3) {
    return decryptDataLegacy(encryptedText);
  }
  
  // Plain text (no encryption)
  return encryptedText;
}

function decryptDataQuantum(encryptedText: string): string {
  const quantumKeys = getQuantumKeys();
  if (!quantumKeys) {
    throw new Error('Quantum keys not available for decryption');
  }
  
  try {
    const parts = encryptedText.split(':');
    const [version, kyberCiphertextHex, rsaEncryptedHex, ivHex, authTagHex, encryptedData] = parts;
    
    // Step 1: Decrypt RSA layer to get protected AES key (only 32 bytes encrypted)
    const rsaEncrypted = Buffer.from(rsaEncryptedHex, 'hex');
    const protectedKey = privateDecrypt(
      {
        key: quantumKeys.rsa.privateKey,
        padding: 1 // PKCS1_OAEP_PADDING
      },
      rsaEncrypted
    );
    
    // Step 2: Decapsulate Kyber to get shared secret
    const kyberCiphertext = Buffer.from(kyberCiphertextHex, 'hex');
    const kyberPrivateKey = Buffer.from(quantumKeys.kyber.privateKey, 'hex');
    const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, kyberPrivateKey);
    
    // Step 3: XOR to recover AES key
    const aesKey = Buffer.alloc(AES_KEY_LENGTH);
    for (let i = 0; i < AES_KEY_LENGTH; i++) {
      aesKey[i] = protectedKey[i] ^ sharedSecret[i];
    }
    
    // Step 4: Decrypt data with AES-GCM
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = createDecipheriv(ALGORITHM, aesKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    console.error('[CRYPTO] Quantum decryption failed:', error.message);
    throw new Error(`Quantum decryption failed: ${error.message}`);
  }
}

function decryptDataLegacy(encryptedText: string): string {
  const key = getEncryptionKey();
  if (!key) {
    // No encryption key - assume plain text
    return encryptedText;
  }
  
  const parts = encryptedText.split(':');
  let ivHex: string, authTagHex: string, encrypted: string;
  
  if (parts[0] === 'v1') {
    [, ivHex, authTagHex, encrypted] = parts;
  } else {
    [ivHex, authTagHex, encrypted] = parts;
  }
  
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
    console.log(`[REGISTRY] Loaded registry with ${Object.keys(registry).length} lodges (quantum-encrypted: ${encryptedString.startsWith('v2:')})`);
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
    const isQuantum = encryptedData.startsWith('v2:');
    await store.set('lodges', encryptedData, {
      metadata: { 
        lastUpdate: new Date().toISOString(),
        encrypted: isQuantum ? 'quantum-hybrid' : !!getEncryptionKey() ? 'legacy-aes' : 'none',
        lodgeCount: Object.keys(registry).length
      }
    });
    console.log(`[BLOBS] Registry saved successfully (${isQuantum ? 'quantum-hybrid' : 'legacy'} encryption)`);
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
