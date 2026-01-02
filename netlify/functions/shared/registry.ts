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
const localMasterKeyPath = join(process.cwd(), '.netlify', 'master-key.txt');

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

async function getQuantumKeys(): Promise<QuantumKeys | null> {
  // In local dev, load from file
  if (isLocalDev) {
    if (existsSync(localQuantumKeysPath)) {
      const data = readFileSync(localQuantumKeysPath, 'utf-8');
      return JSON.parse(data);
    }
    console.log('[QUANTUM] No local quantum keys found - encryption disabled in dev');
    return null;
  }
  
  // In production: public keys from env, private keys from Blobs (encrypted)
  const kyberPubKey = process.env.KYBER_PUBLIC_KEY;
  const rsaPubKeyB64 = process.env.RSA_PUBLIC_KEY_B64;
  const masterKey = process.env.QUANTUM_MASTER_KEY;
  
  if (!kyberPubKey || !rsaPubKeyB64 || !masterKey) {
    console.log('[QUANTUM] Missing keys in env - encryption disabled');
    return null;
  }
  
  // Load encrypted private keys from Netlify Blobs
  let kyberPrivKey: string;
  let rsaPrivKeyB64: string;
  
  try {
    const keysStore = getStore('quantum-keys');
    const encryptedKeysJson = await keysStore.get('private-keys', { type: 'text' });
    
    if (!encryptedKeysJson) {
      console.log('[QUANTUM] Private keys not found in Blobs - encryption disabled');
      return null;
    }
    
    // Decrypt private keys
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
      console.log('[QUANTUM] Invalid private keys format in Blobs');
      return null;
    }
  } catch (error) {
    console.error('[QUANTUM] Error loading/decrypting private keys from Blobs:', error);
    return null;
  }
  
  // Decode RSA keys from base64
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
async function encryptData(text: string): Promise<string> {
  // In local dev with NETLIFY_DEV, skip encryption
  if (isLocalDev) {
    console.log('[CRYPTO] Local dev mode - skipping encryption');
    return text;
  }
  
  const quantumKeys = await getQuantumKeys();
  if (!quantumKeys) {
    throw new Error('Quantum keys not available for encryption');
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
    
    // Step 4: Encrypt ONLY the protected key with RSA-4096 (32 bytes fits easily)
    // Kyber ciphertext (1088 bytes) stays plaintext
    const rsaEncryptedKey = publicEncrypt(
      {
        key: quantumKeys.rsa.publicKey,
        padding: 1 // PKCS1_OAEP_PADDING
      },
      protectedKey
    );
    
    // Format: version:kyber_ciphertext_hex:rsa_encrypted_key:iv:authTag:aes_data
    return `v2:${kyberCiphertext.toString('hex')}:${rsaEncryptedKey.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedData}`;
  } catch (error: any) {
    console.error('[CRYPTO] Quantum encryption failed:', error.message);
    throw new Error(`Quantum encryption failed: ${error.message}`);
  }
}

/**
 * Quantum-resistant hybrid decryption: RSA + Kyber + AES
 */
async function decryptData(encryptedText: string): Promise<string> {
  // In local dev, data is plaintext
  if (isLocalDev) {
    return encryptedText;
  }
  
  console.log(`[DECRYPT] Input: ${encryptedText.substring(0, 50)}... (${encryptedText.length} chars)`);
  
  // ONLY support v2 format: v2:kyber_ciphertext:rsa_encrypted_key:iv:authTag:aes_data (6 parts)
  if (!encryptedText.startsWith('v2:')) {
    throw new Error(`Unsupported encryption format. Expected v2:... but got: ${encryptedText.substring(0, 30)}`);
  }
  
  const parts = encryptedText.split(':');
  if (parts.length !== 6) {
    throw new Error(`Invalid v2 format. Expected 6 parts but got ${parts.length}`);
  }
  
  return await decryptDataQuantum(encryptedText);
}

async function decryptDataQuantum(encryptedText: string): Promise<string> {
  console.log('[DECRYPT-QUANTUM] Starting quantum decryption...');
  
  const quantumKeys = await getQuantumKeys();
  if (!quantumKeys) {
    console.error('[DECRYPT-QUANTUM] Quantum keys not available');
    throw new Error('Quantum keys not available for decryption');
  }
  
  try {
    const parts = encryptedText.split(':');
    const [version, kyberCiphertextHex, rsaEncryptedKeyHex, ivHex, authTagHex, encryptedData] = parts;
    
    console.log(`[DECRYPT-QUANTUM] Kyber: ${kyberCiphertextHex.substring(0, 50)}...`);
    console.log(`[DECRYPT-QUANTUM] RSA key: ${rsaEncryptedKeyHex.substring(0, 50)}...`);
    
    // Step 1: Decrypt RSA layer to get protected key
    const rsaEncryptedKey = Buffer.from(rsaEncryptedKeyHex, 'hex');
    const protectedKey = privateDecrypt(
      {
        key: quantumKeys.rsa.privateKey,
        padding: 1 // PKCS1_OAEP_PADDING
      },
      rsaEncryptedKey
    );
    
    // Step 2: Get Kyber ciphertext (plaintext, not encrypted)
    const kyberCiphertext = Buffer.from(kyberCiphertextHex, 'hex');
    
    // Step 3: Decapsulate with ML-KEM to get shared secret
    const kyberPrivateKey = Buffer.from(quantumKeys.kyber.privateKey, 'hex');
    const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, kyberPrivateKey);
    
    // Step 4: XOR to recover AES key
    const aesKey = Buffer.alloc(AES_KEY_LENGTH);
    for (let i = 0; i < AES_KEY_LENGTH; i++) {
      aesKey[i] = protectedKey[i] ^ sharedSecret[i];
    }
    
    // Step 5: Decrypt data with AES-GCM
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = createDecipheriv(ALGORITHM, aesKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    console.log(`[DECRYPT-QUANTUM] ✓ Decryption successful, result length: ${decrypted.length}`);
    return decrypted;
  } catch (error: any) {
    console.error('[CRYPTO] Quantum decryption failed:', error?.message);
    console.error('[CRYPTO] Error details:', error);
    throw new Error(`Quantum decryption failed: ${error?.message}`);
  }
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
    console.log(`[REGISTRY] Encrypted data length: ${encryptedString.length} chars, starts with: ${encryptedString.substring(0, 50)}...`);
    
    const jsonString = await decryptData(encryptedString);
    console.log(`[REGISTRY] Decrypted data length: ${jsonString.length} chars, is valid JSON: ${jsonString.startsWith('{') || jsonString.startsWith('[')}`);
    
    let registry: Registry;
    try {
      registry = JSON.parse(jsonString);
      console.log(`[REGISTRY] ✓ Loaded registry with ${Object.keys(registry).length} lodges`);
    } catch (parseError: any) {
      console.error('[REGISTRY] JSON parse error:', parseError?.message);
      console.error('[REGISTRY] Data preview:', jsonString.substring(0, 100));
      return {};
    }
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
    const encryptedData = await encryptData(jsonString);
    await store.set('lodges', encryptedData, {
      metadata: { 
        lastUpdate: new Date().toISOString(),
        encrypted: 'quantum-hybrid',
        lodgeCount: Object.keys(registry).length
      }
    });
    console.log(`[BLOBS] Registry saved successfully (quantum-hybrid encryption)`);
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
