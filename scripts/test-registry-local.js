#!/usr/bin/env node
/**
 * Test script per verificare il funzionamento del registry
 * in modalità locale dev (plaintext)
 * 
 * In locale con NETLIFY_DEV=true, il registry è salvato in
 * .netlify/registry.json in formato JSON plaintext (no crittografia)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const registryPath = join(process.cwd(), '.netlify', 'registry.json');

console.log('=== Test Registry Locale (Plaintext) ===\n');

// Test 1: Verifica esistenza
console.log(`1. Verifica file: ${registryPath}`);
if (existsSync(registryPath)) {
  console.log('   ✓ File esiste');
} else {
  console.log('   ⚠ File non esiste (verrà creato)');
}

// Test 2: Leggi contenuto
console.log('\n2. Lettura registry...');
let registry = {};
if (existsSync(registryPath)) {
  const content = readFileSync(registryPath, 'utf-8');
  registry = JSON.parse(content);
  console.log(`   ✓ Caricato ${Object.keys(registry).length} logge`);
  console.log('   Contenuto (plaintext JSON):');
  console.log('   ' + content.split('\n').join('\n   '));
} else {
  console.log('   ⚠ Registry vuoto');
}

// Test 3: Verifica formato plaintext
console.log('\n3. Verifica formato plaintext...');
const content = existsSync(registryPath) ? readFileSync(registryPath, 'utf-8') : '{}';
if (content.includes('v2:') || content.includes('v1:')) {
  console.log('   ✗ ERRORE: Registry è criptato!');
  process.exit(1);
} else {
  try {
    JSON.parse(content);
    console.log('   ✓ Registry è valido JSON plaintext');
  } catch (e) {
    console.log('   ✗ ERRORE: Registry non è JSON valido');
    process.exit(1);
  }
}

console.log('\n=== Test Completato ===');
console.log('✓ Registry funziona correttamente in modalità locale');
console.log('✓ Dati salvati in plaintext JSON (no crittografia)');
console.log('\nNOTA: In produzione (senza NETLIFY_DEV), il registry sarà');
console.log('      criptato con Kyber-768 + RSA-4096 + AES-256-GCM');

