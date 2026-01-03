#!/usr/bin/env node
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { generateKeyPairSync } from 'crypto';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const quantumKeysPath = join(process.cwd(), '.netlify', 'quantum-keys.json');

// Ensure .netlify directory exists
const dir = join(process.cwd(), '.netlify');
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

// Generate ML-KEM-768 (Kyber) keys
console.log('[QUANTUM] Generating ML-KEM-768 (Kyber) keypair...');
const kyberSeed = crypto.getRandomValues(new Uint8Array(64));
const kyberKeypair = ml_kem768.keygen(kyberSeed);

// Generate RSA-4096 keys for hybrid encryption
console.log('[QUANTUM] Generating RSA-4096 keypair...');
const { publicKey: rsaPublicKey, privateKey: rsaPrivateKey } = generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const quantumKeys = {
  kyber: {
    publicKey: Buffer.from(kyberKeypair.publicKey).toString('hex'),
    privateKey: Buffer.from(kyberKeypair.secretKey).toString('hex')
  },
  rsa: {
    publicKey: Buffer.from(rsaPublicKey).toString('base64'),
    privateKey: Buffer.from(rsaPrivateKey).toString('base64')
  }
};

// Save to file
writeFileSync(quantumKeysPath, JSON.stringify(quantumKeys, null, 2), 'utf-8');

console.log('[QUANTUM] Keys generated successfully!');
console.log('[QUANTUM] Saved to:', quantumKeysPath);
console.log('\n[QUANTUM] For production, set these environment variables:');
console.log(`KYBER_PUBLIC_KEY="${quantumKeys.kyber.publicKey}"`);
console.log(`KYBER_PRIVATE_KEY="${quantumKeys.kyber.privateKey}"`);
console.log(`RSA_PUBLIC_KEY_B64="${quantumKeys.rsa.publicKey}"`);
console.log(`RSA_PRIVATE_KEY_B64="${quantumKeys.rsa.privateKey}"`);
console.log('\n[QUANTUM] ⚠️  Keep private keys secure! Never commit to git!');
