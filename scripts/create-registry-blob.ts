#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createCipheriv, publicEncrypt, randomBytes } from 'crypto';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AES_KEY_LENGTH = 32;

interface QuantumKeys {
  kyber: { publicKey: string; privateKey: string };
  rsa: { publicKey: string; privateKey: string };
}

function encryptDataQuantum(plaintext: string, quantumKeys: QuantumKeys): string {
  const aesKey = randomBytes(AES_KEY_LENGTH);
  const kyberPublicKey = Buffer.from(quantumKeys.kyber.publicKey, 'hex');
  const { cipherText: kyberCiphertext, sharedSecret } = ml_kem768.encapsulate(kyberPublicKey);

  const protectedKey = Buffer.alloc(AES_KEY_LENGTH);
  for (let i = 0; i < AES_KEY_LENGTH; i++) {
    protectedKey[i] = aesKey[i] ^ sharedSecret[i];
  }

  const rsaPublicKeyPem = Buffer.from(quantumKeys.rsa.publicKey, 'base64').toString('utf-8');
  const rsaEncrypted = publicEncrypt(
    { key: rsaPublicKeyPem, padding: 1 },
    protectedKey
  );

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, aesKey, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `v2:${Buffer.from(kyberCiphertext).toString('hex')}:${rsaEncrypted.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

async function main() {
  console.log('[BUILD] Creating encrypted registry blob...');

  try {
    const registryPath = join(process.cwd(), '.netlify', 'registry.json');
    const keysPath = join(process.cwd(), '.netlify', 'quantum-keys.json');

    if (!existsSync(registryPath) || !existsSync(keysPath)) {
      console.log('[BUILD] Registry or quantum keys not found locally (.netlify). Skipping blob generation.');
      process.exit(0);
    }

    const registryData = readFileSync(registryPath, 'utf-8');
    const registry = JSON.parse(registryData);
    console.log('[BUILD] ✓ Registry loaded:', Object.keys(registry).length, 'lodge(s)');

    const keysData = readFileSync(keysPath, 'utf-8');
    const quantumKeys: QuantumKeys = JSON.parse(keysData);
    console.log('[BUILD] ✓ Quantum keys loaded');

    // Encrypt
    console.log('[BUILD] Encrypting with quantum-hybrid...');
    const encryptedData = encryptDataQuantum(JSON.stringify(registry), quantumKeys);
    console.log('[BUILD] ✓ Encrypted:', encryptedData.length, 'bytes');

    // Save to public folder as hidden resource
    mkdirSync(join(process.cwd(), 'public', '.well-known'), { recursive: true });
    const blobPath = join(process.cwd(), 'public', '.well-known', 'gadu-registry.blob');
    writeFileSync(blobPath, encryptedData, 'utf-8');
    console.log('[BUILD] ✓ Blob saved to:', blobPath);

    console.log('[BUILD] ✅ Registry blob creation complete!');
    process.exit(0);
  } catch (error: any) {
    console.error('[BUILD] ❌ Error:', error.message);
    console.error('[BUILD] Stack:', error.stack);
    process.exit(1);
  }
}

main();
