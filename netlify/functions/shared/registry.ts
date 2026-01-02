import { getStore } from '@netlify/blobs';
import { LodgeConfig, Registry } from '../../../types/lodge';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createCipheriv, createDecipheriv, randomBytes, publicEncrypt, privateDecrypt } from 'crypto';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

const isLocalDev = process.env.NETLIFY_DEV === 'true';
const localRegistryPath = join(process.cwd(), '.netlify', 'registry.json');
const localQuantumKeysPath = join(process.cwd(), '.netlify', 'quantum-keys.json');

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
  if (isLocalDev) {
    if (existsSync(localQuantumKeysPath)) {
      const data = readFileSync(localQuantumKeysPath, 'utf-8');
      return JSON.parse(data);
    }
    console.log('[QUANTUM] No local quantum keys found - encryption disabled in dev');
    return null;
  }
  
  const kyberPubKey = process.env.KYBER_PUBLIC_KEY;
  const rsaPubKeyB64 = process.env.RSA_PUBLIC_KEY_B64;
  const masterKey = process.env.QUANTUM_MASTER_KEY;
  
  if (!kyberPubKey || !rsaPubKeyB64 || !masterKey) {
    console.log('[QUANTUM] Missing keys in env - encryption disabled');
    return null;
  }
  
  let kyberPrivKey: string;
  let rsaPrivKeyB64: string;
  
  try {
    const keysStore = getStore('quantum-keys');
    const encryptedKeysJson = await keysStore.get('private-keys', { type: 'text' });
    
    if (!encryptedKeysJson) {
      console.log('[QUANTUM] Private keys not found in Blobs - encryption disabled');
      return null;
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
      console.log('[QUANTUM] Invalid private keys format in Blobs');
      return null;
    }
  } catch (error) {
    console.error('[QUANTUM] Error loading/decrypting private keys from Blobs:', error);
    return null;
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
  if (isLocalDev) {
    console.log('[CRYPTO] Local dev mode - skipping encryption');
    return text;
  }
  
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
  if (isLocalDev) {
    return encryptedText;
  }
  
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

function ensureLocalRegistryDir() {
  const dir = join(process.cwd(), '.netlify');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export async function loadRegistry(): Promise<Registry> {
  if (isLocalDev) {
    ensureLocalRegistryDir();
    if (existsSync(localRegistryPath)) {
      const data = readFileSync(localRegistryPath, 'utf-8');
      return JSON.parse(data);
    }
    return {};
  }
  
  try {
    const store = getStore('gadu-registry');
    const data = await store.get('lodges');
    
    if (!data) {
      return {};
    }
    
    const encryptedString = typeof data === 'string' ? data : new TextDecoder().decode(data);
    const jsonString = await decryptData(encryptedString);
    
    return JSON.parse(jsonString);
  } catch (error: any) {
    console.error('[REGISTRY] Error loading from Blobs:', error?.message || error);
    return {};
  }
}

export async function saveRegistry(registry: Registry): Promise<void> {
  if (isLocalDev) {
    ensureLocalRegistryDir();
    writeFileSync(localRegistryPath, JSON.stringify(registry, null, 2), 'utf-8');
    return;
  }
  
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
  } catch (error: any) {
    console.error('[BLOBS] Failed to save registry:', error?.message);
  }
}

export async function logAuditEvent(event: string, data: any): Promise<void> {
  if (isLocalDev) {
    console.log(`[AUDIT] ${event}:`, data);
    return;
  }
  
  const auditStore = getStore('gadu-audit');
  const timestamp = new Date().toISOString();
  await auditStore.set(`${timestamp}-${event}`, JSON.stringify(data));
}
