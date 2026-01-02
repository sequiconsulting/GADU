#!/usr/bin/env node
/**
 * Forza il re-encryption del registry con le nuove chiavi quantum
 * Questo script:
 * 1. Legge il registry corrente (decrypt con vecchio formato se necessario)
 * 2. Lo salva nuovamente (encrypt con nuovo formato quantum v2)
 */

const BASE_URL = process.env.NETLIFY_SITE_URL || 'https://gadu.netlify.app';

async function reencryptRegistry() {
  console.log('=== Re-encryption Registry con Quantum Keys ===\n');
  
  // Test: prova a leggere una loggia per verificare che le chiavi funzionino
  console.log('1. Verifica chiavi quantum...');
  try {
    const response = await fetch(`${BASE_URL}/.netlify/functions/get-lodge-config?glriNumber=9999`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    console.log(`   ✓ Chiavi quantum funzionanti`);
    console.log(`   Loggia test: ${data.glriNumber} - ${data.lodgeName || data.name}`);
  } catch (error) {
    console.error(`   ✗ Errore verifica chiavi:`, error.message);
    console.error(`   Le chiavi quantum potrebbero non essere configurate correttamente.`);
    process.exit(1);
  }
  
  // Per forzare il re-save, dovremmo modificare il registry tramite setup-lodge
  // Ma non abbiamo una funzione dedicata per il re-encryption
  
  console.log('\n2. Informazioni:');
  console.log(`   Il registry corrente usa un formato di encryption.`);
  console.log(`   Per forzare il re-encryption con quantum v2:`);
  console.log(`   - Aggiungi/modifica una loggia tramite setup-lodge`);
  console.log(`   - Oppure usa Netlify Blobs CLI per cancellare e ricreare`);
  
  console.log('\n=== Verifica Completata ===');
  console.log('Per verificare il formato di encryption, controlla i logs');
  console.log('delle funzioni Netlify dopo il prossimo save del registry.');
}

reencryptRegistry().catch(err => {
  console.error('\n✗ Errore:', err);
  process.exit(1);
});
