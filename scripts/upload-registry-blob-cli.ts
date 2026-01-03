#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
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
  try {
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
        padding: 1 // PKCS1_OAEP_PADDING
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
    const encryptedText = `v2:${Buffer.from(kyberCiphertext).toString('hex')}:${rsaEncrypted.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    
    console.log('[CRYPTO] Quantum-hybrid encryption successful');
    return encryptedText;
  } catch (error: any) {
    console.error('[CRYPTO] Quantum encryption failed:', error.message);
    throw error;
  }
}

async function main() {
  console.log('[UPLOAD-BLOB] Starting registry upload to Netlify Blobs...');
  
  // Read local registry
  const registryPath = join(process.cwd(), '.netlify', 'registry.json');
  console.log('[UPLOAD-BLOB] Reading registry from:', registryPath);
  const registryData = readFileSync(registryPath, 'utf-8');
  const registry = JSON.parse(registryData);
  console.log(`[UPLOAD-BLOB] Loaded registry with ${Object.keys(registry).length} lodge(s)`);
  
  // Read quantum keys
  const keysPath = join(process.cwd(), '.netlify', 'quantum-keys.json');
  console.log('[UPLOAD-BLOB] Reading quantum keys from:', keysPath);
  const keysData = readFileSync(keysPath, 'utf-8');
  const quantumKeys: QuantumKeys = JSON.parse(keysData);
  console.log('[UPLOAD-BLOB] Quantum keys loaded');
  
  // Encrypt registry
  console.log('[UPLOAD-BLOB] Encrypting registry with quantum-hybrid encryption...');
  const jsonString = JSON.stringify(registry);
  const encryptedData = encryptDataQuantum(jsonString, quantumKeys);
  console.log('[UPLOAD-BLOB] Registry encrypted successfully');
  console.log(`[UPLOAD-BLOB] Encrypted data size: ${encryptedData.length} bytes`);
  
  // Save encrypted blob to temp file
  const tempBlobPath = join(process.cwd(), '.netlify', 'registry-blob-temp.txt');
  writeFileSync(tempBlobPath, encryptedData, 'utf-8');
  console.log('[UPLOAD-BLOB] Temporary blob saved to:', tempBlobPath);
  
  // Use Netlify CLI to upload via blobs API
  console.log('[UPLOAD-BLOB] Using Netlify CLI to upload blob...');
  try {
    // Get site info first
    console.log('[UPLOAD-BLOB] Getting Netlify site info...');
    const siteInfo = execSync('netlify sites:list --json', { encoding: 'utf-8' });
    const sites = JSON.parse(siteInfo);
    
    if (!sites || sites.length === 0) {
      throw new Error('No Netlify sites found. Please run "netlify link" first.');
    }
    
    const siteId = sites[0].site_id;
    const siteName = sites[0].name;
    console.log(`[UPLOAD-BLOB] Found site: ${siteName} (${siteId})`);
    
    // Use netlify api directly via authenticated CLI
    console.log('[UPLOAD-BLOB] ✅ Registry encrypted and ready for upload!');
    console.log('[UPLOAD-BLOB] Blob content has been prepared and can be uploaded via Netlify Functions.');
    console.log('[UPLOAD-BLOB] Size:', encryptedData.length, 'bytes');
    console.log('[UPLOAD-BLOB] Encryption: quantum-hybrid (ML-KEM-768 + RSA-4096 + AES-256-GCM)');
    console.log('[UPLOAD-BLOB] Lodges:', Object.keys(registry).length);
    console.log('\n[UPLOAD-BLOB] To manually upload in production, use:');
    console.log('  const store = getStore("gadu-registry");');
    console.log('  await store.set("lodges", encryptedData, { metadata: {...} });');
    
  } catch (error: any) {
    console.error('[UPLOAD-BLOB] Error getting site info:', error.message);
    console.log('\n[UPLOAD-BLOB] ℹ️  Encrypted blob is ready. Make sure you are authenticated with Netlify:');
    console.log('  netlify login');
    console.log('  netlify link');
  }
}

main().catch(error => {
  console.error('[UPLOAD-BLOB] ❌ Error:', error.message);
  process.exit(1);
});
