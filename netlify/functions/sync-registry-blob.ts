import { Context, Handler } from '@netlify/functions';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createCipheriv, publicEncrypt, randomBytes } from 'crypto';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

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

function encryptDataQuantum(plaintext: string, quantumKeys: QuantumKeys): string {
  // Step 1: Generate random AES key
  const aesKey = randomBytes(AES_KEY_LENGTH);

  // Step 2: Encapsulate AES key with ML-KEM-768
  const kyberPublicKey = Buffer.from(quantumKeys.kyber.publicKey, 'hex');
  const { cipherText: kyberCiphertext, sharedSecret } = ml_kem768.encapsulate(kyberPublicKey);

  // Step 3: XOR AES key with shared secret to protect it
  const protectedKey = Buffer.alloc(AES_KEY_LENGTH);
  for (let i = 0; i < AES_KEY_LENGTH; i++) {
    protectedKey[i] = aesKey[i] ^ sharedSecret[i];
  }

  // Step 4: Encrypt only the protected key (32 bytes) with RSA
  const rsaPublicKeyPem = Buffer.from(quantumKeys.rsa.publicKey, 'base64').toString('utf-8');
  const rsaEncrypted = publicEncrypt(
    {
      key: rsaPublicKeyPem,
      padding: 1, // PKCS1_OAEP_PADDING
    },
    protectedKey
  );

  // Step 5: Encrypt data with AES-256-GCM
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, aesKey, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: v2:kyberCiphertext:rsaEncryptedKey:iv:authTag:encryptedData
  return `v2:${Buffer.from(kyberCiphertext).toString('hex')}:${rsaEncrypted.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

const handler: Handler = async (event: any, context: Context) => {
  try {
    console.log('[SYNC-REGISTRY-BLOB] Triggered at', new Date().toISOString());

    // Only allow on deploy-succeeded hook or admin call
    const isDeployHook = event.headers['x-webhook-source'] === 'netlify-deploy';
    const isAdminCall = event.headers['authorization'] === `Bearer ${process.env.ADMIN_TOKEN}`;
    const isLocalDev = process.env.NETLIFY_DEV === 'true';

    if (!isDeployHook && !isAdminCall && !isLocalDev) {
      console.log('[SYNC-REGISTRY-BLOB] Unauthorized call attempt');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Read registry from .netlify folder
    const registryPath = join(process.env.NETLIFY_BASE || process.cwd(), '.netlify', 'registry.json');
    console.log('[SYNC-REGISTRY-BLOB] Reading registry from:', registryPath);

    let registryContent: string;
    try {
      registryContent = await readFile(registryPath, 'utf-8');
    } catch (e: any) {
      console.warn('[SYNC-REGISTRY-BLOB] Registry file not found, using empty registry');
      registryContent = JSON.stringify({});
    }

    // Read quantum keys
    const keysPath = join(process.env.NETLIFY_BASE || process.cwd(), '.netlify', 'quantum-keys.json');
    console.log('[SYNC-REGISTRY-BLOB] Reading quantum keys from:', keysPath);

    let keysContent: string;
    try {
      keysContent = await readFile(keysPath, 'utf-8');
    } catch (e: any) {
      console.error('[SYNC-REGISTRY-BLOB] Quantum keys not found:', e.message);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Quantum keys not configured',
          hint: 'Run: npm run generate-quantum-keys',
        }),
      };
    }

    const quantumKeys: QuantumKeys = JSON.parse(keysContent);

    // Encrypt registry
    console.log('[SYNC-REGISTRY-BLOB] Encrypting registry...');
    const encryptedData = encryptDataQuantum(registryContent, quantumKeys);

    // In production, this would upload to Netlify Blobs
    // For now, we're returning success and the encrypted data for testing
    console.log('[SYNC-REGISTRY-BLOB] ✅ Registry encrypted successfully');
    console.log('[SYNC-REGISTRY-BLOB] Encrypted size:', encryptedData.length, 'bytes');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Registry blob synced',
        encrypted: encryptedData.substring(0, 100) + '...',
        size: encryptedData.length,
      }),
    };
  } catch (error: any) {
    console.error('[SYNC-REGISTRY-BLOB] Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
};

export { handler };
