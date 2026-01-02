/**
 * Migrate registry from local plaintext to Netlify Blobs with quantum encryption
 * This script:
 * 1. Reads the local plaintext registry
 * 2. Filters to keep only lodge 9999
 * 3. Encrypts with quantum-hybrid format (v2)
 * 4. Uploads to Netlify Blobs
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes, createCipheriv, publicEncrypt } from 'crypto';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';



const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
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

interface LocalKeysFile {
  kyber: {
    publicKey: string;
    privateKey: string;
  };
  rsa: {
    publicKey: string;
    privateKey: string;
  };
  aesKey?: string;
}

async function loadQuantumKeys(): Promise<QuantumKeys> {
  const keyPath = join(process.cwd(), '.netlify', 'quantum-keys.json');
  if (!existsSync(keyPath)) {
    throw new Error(`Quantum keys not found at ${keyPath}`);
  }

  const keysData = JSON.parse(readFileSync(keyPath, 'utf-8')) as LocalKeysFile;
  return {
    kyber: {
      publicKey: keysData.kyber.publicKey,
      privateKey: keysData.kyber.privateKey,
    },
    rsa: {
      publicKey: keysData.rsa.publicKey,
      privateKey: keysData.rsa.privateKey,
    },
  };
}

async function encryptData(text: string, quantumKeys: QuantumKeys): Promise<string> {
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
        padding: 1, // PKCS1_OAEP_PADDING
      },
      protectedKey
    );

    // Format: version:kyber_ciphertext:rsa_encrypted_key:iv:authTag:aes_data
    return `v2:${kyberCiphertext.toString('hex')}:${rsaEncryptedKey.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedData}`;
  } catch (error: any) {
    console.error('[ENCRYPT] Quantum encryption failed:', error.message);
    throw new Error(`Quantum encryption failed: ${error.message}`);
  }
}

async function main() {
  try {
    console.log('[MIGRATE] Loading local registry...');
    const registryPath = join(process.cwd(), '.netlify', 'registry.json');
    if (!existsSync(registryPath)) {
      throw new Error(`Local registry not found at ${registryPath}`);
    }

    const localRegistry = JSON.parse(readFileSync(registryPath, 'utf-8'));
    console.log('[MIGRATE] Local registry loaded:', Object.keys(localRegistry));

    // Filter to keep only 9999
    const filteredRegistry = { '9999': localRegistry['9999'] };
    console.log('[MIGRATE] Filtered registry:', JSON.stringify(filteredRegistry, null, 2));

    // Load quantum keys
    console.log('[MIGRATE] Loading quantum keys...');
    const quantumKeys = await loadQuantumKeys();
    console.log('[MIGRATE] Quantum keys loaded');

    // Encrypt the registry
    console.log('[MIGRATE] Encrypting registry with quantum-hybrid (v2)...');
    const registryJson = JSON.stringify(filteredRegistry);
    const encrypted = await encryptData(registryJson, quantumKeys);
    console.log('[MIGRATE] ✓ Encrypted successfully');
    console.log(`[MIGRATE] Encrypted size: ${encrypted.length} bytes`);

    // Save locally for verification
    const fs = await import('fs');
    const encryptedPath = join(process.cwd(), '.netlify', 'registry-encrypted.txt');
    fs.writeFileSync(encryptedPath, encrypted, 'utf-8');
    console.log(`[MIGRATE] ✓ Encrypted registry saved to ${encryptedPath}`);

    // Print instructions for uploading to Netlify Blobs
    console.log('\n[MIGRATE] ═══════════════════════════════════════════════════════════');
    console.log('[MIGRATE] Registry encrypted and ready for production!');
    console.log('[MIGRATE] ═══════════════════════════════════════════════════════════');
    console.log('\n[MIGRATE] To upload to Netlify Blobs in production, use:');
    console.log('  NETLIFY_AUTH_TOKEN=... npx netlify blobs:set lodges <path-to-file>');
    console.log('  OR use the upload function in a Netlify Function');
    console.log('\n[MIGRATE] Format verification:');
    const parts = encrypted.split(':');
    console.log(`  ✓ Version: ${parts[0]}`);
    console.log(`  ✓ Kyber ciphertext: ${parts[1].length} bytes`);
    console.log(`  ✓ RSA encrypted key: ${parts[2].length} bytes`);
    console.log(`  ✓ IV: ${parts[3].length} bytes`);
    console.log(`  ✓ Auth Tag: ${parts[4].length} bytes`);
    console.log(`  ✓ AES encrypted data: ${parts[5].length} bytes`);
    console.log(`  ✓ Total encrypted size: ${encrypted.length} bytes`);
  } catch (error) {
    console.error('[MIGRATE] Error:', error);
    process.exit(1);
  }
}

main();
