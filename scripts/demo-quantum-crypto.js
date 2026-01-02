#!/usr/bin/env node
/**
 * Demo script che mostra come funziona la crittografia quantum
 * senza effettivamente generare chiavi o modificare Netlify
 */

import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { generateKeyPairSync } from 'crypto';

console.log('=== Demo Quantum Key Generation ===\n');

console.log('1. Generazione ML-KEM-768 keypair (NIST FIPS 203)...');
const startKyber = Date.now();
const kyberKeys = ml_kem768.keygen();
const kyberTime = Date.now() - startKyber;
console.log(`   ✓ Public key: ${kyberKeys.publicKey.length} bytes`);
console.log(`   ✓ Secret key: ${kyberKeys.secretKey.length} bytes`);
console.log(`   Time: ${kyberTime}ms\n`);

console.log('2. Generazione RSA-4096 keypair (classical)...');
const startRSA = Date.now();
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
const rsaTime = Date.now() - startRSA;
console.log(`   ✓ Public key: ${publicKey.length} bytes (PEM)`);
console.log(`   ✓ Private key: ${privateKey.length} bytes (PEM)`);
console.log(`   Time: ${rsaTime}ms\n`);

console.log('3. Test ML-KEM encapsulation/decapsulation...');
const testMessage = Buffer.from('Test AES key (32 bytes)'.padEnd(32, '0'));
const startEnc = Date.now();
const { cipherText, sharedSecret } = ml_kem768.encapsulate(kyberKeys.publicKey);
const encTime = Date.now() - startEnc;
console.log(`   ✓ Ciphertext: ${cipherText.length} bytes`);
console.log(`   ✓ Shared secret: ${sharedSecret.length} bytes`);
console.log(`   Encapsulation time: ${encTime}ms`);

const startDec = Date.now();
const recoveredSecret = ml_kem768.decapsulate(cipherText, kyberKeys.secretKey);
const decTime = Date.now() - startDec;
console.log(`   ✓ Secret recovered: ${Buffer.compare(sharedSecret, recoveredSecret) === 0 ? 'OK' : 'FAIL'}`);
console.log(`   Decapsulation time: ${decTime}ms\n`);

console.log('=== Performance Summary ===');
console.log(`ML-KEM-768 keygen:  ${kyberTime}ms`);
console.log(`RSA-4096 keygen:   ${rsaTime}ms`);
console.log(`ML-KEM encaps:     ${encTime}ms`);
console.log(`ML-KEM decaps:     ${decTime}ms`);
console.log('\n=== Security Levels ===');
console.log('ML-KEM-768:  ~128-bit post-quantum security (NIST FIPS 203)');
console.log('RSA-4096:    ~152-bit classical security');
console.log('AES-256:     256-bit security (quantum-resistant for symmetric)');
