import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { generateKeyPairSync, randomBytes, createCipheriv } from 'crypto';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const SITE_ID_FLAG = '--site-id';

interface KeyPair {
  kyber: {
    publicKey: string;
    privateKey: string;
  };
  rsa: {
    publicKey: string;
    privateKey: string;
  };
}

function generateKeys(): KeyPair {
  console.log('[KEYGEN] Generating ML-KEM-768 keypair (NIST FIPS 203)...');
  const kyberKeypair = ml_kem768.keygen();
  
  const kyberPubKey = Buffer.from(kyberKeypair.publicKey).toString('hex');
  const kyberPrivKey = Buffer.from(kyberKeypair.secretKey).toString('hex');
  
  console.log('[KEYGEN] Generating RSA-4096 keypair...');
  const rsaKeypair = generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  
  return {
    kyber: {
      publicKey: kyberPubKey,
      privateKey: kyberPrivKey
    },
    rsa: {
      publicKey: rsaKeypair.publicKey,
      privateKey: rsaKeypair.privateKey
    }
  };
}

function generateMasterKey(): string {
  console.log('[MASTER] Generating AES-256 master key...');
  const masterKey = randomBytes(32).toString('hex'); // 64 hex chars
  
  const localKeysDir = join(process.cwd(), '.netlify');
  if (!existsSync(localKeysDir)) {
    mkdirSync(localKeysDir, { recursive: true });
  }
  
  const masterKeyPath = join(localKeysDir, 'master-key.txt');
  writeFileSync(masterKeyPath, masterKey, 'utf-8');
  console.log(`[MASTER] ✓ Master key saved to ${masterKeyPath}`);
  
  return masterKey;
}

function loadOrGenerateMasterKey(): string {
  const masterKeyPath = join(process.cwd(), '.netlify', 'master-key.txt');
  
  if (existsSync(masterKeyPath)) {
    console.log('[MASTER] Loading existing master key...');
    return readFileSync(masterKeyPath, 'utf-8').trim();
  }
  
  return generateMasterKey();
}

function encryptPrivateKeys(kyberPrivKey: string, rsaPrivKey: string, masterKey: string): string {
  const rsaPrivB64 = Buffer.from(rsaPrivKey).toString('base64');
  const plaintext = JSON.stringify({
    kyberPrivate: kyberPrivKey,
    rsaPrivateB64: rsaPrivB64,
    createdAt: new Date().toISOString()
  });
  
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(masterKey, 'hex'), iv);
  
  let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return JSON.stringify({
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted
  });
}

function registerKeysToNetlify(kyberPubKey: string, kyberPrivKey: string, rsaPubKey: string, rsaPrivKey: string, masterKey: string, siteId?: string) {
  console.log('[NETLIFY] Registering public keys to environment variables...');
  
  const rsaPubB64 = Buffer.from(rsaPubKey).toString('base64');
  const siteFlag = siteId ? `--site-id ${siteId}` : '';
  
  try {
    execSync(
      `netlify env:set KYBER_PUBLIC_KEY "${kyberPubKey}" ${siteFlag}`,
      { stdio: 'inherit' }
    );
    console.log('[NETLIFY] ✓ KYBER_PUBLIC_KEY registered');
    
    execSync(
      `netlify env:set RSA_PUBLIC_KEY_B64 "${rsaPubB64}" ${siteFlag}`,
      { stdio: 'inherit' }
    );
    console.log('[NETLIFY] ✓ RSA_PUBLIC_KEY_B64 registered');
    
    // Register master key
    execSync(
      `netlify env:set QUANTUM_MASTER_KEY "${masterKey}" ${siteFlag}`,
      { stdio: 'inherit' }
    );
    console.log('[NETLIFY] ✓ QUANTUM_MASTER_KEY registered');
    
    console.log('[NETLIFY] ✓ Public keys registered successfully');
    
  } catch (error: any) {
    console.error('[NETLIFY] Failed to register keys:', error.message);
    process.exit(1);
  }
  
  console.log('\n[BLOBS] Uploading encrypted private keys to Netlify Blobs...');
  
  const encryptedPrivateKeys = encryptPrivateKeys(kyberPrivKey, rsaPrivKey, masterKey);
  
  const tempFile = join(process.cwd(), '.netlify', 'private-keys-temp.json');
  writeFileSync(tempFile, encryptedPrivateKeys, 'utf-8');
  
  try {
    execSync(
      `netlify blobs:set quantum-keys private-keys ${tempFile} ${siteFlag}`,
      { stdio: 'inherit' }
    );
    console.log('[BLOBS] ✓ Encrypted private keys uploaded to quantum-keys store');
    execSync(`rm -f ${tempFile}`);
    
  } catch (error: any) {
    console.error('[BLOBS] Failed to upload private keys:', error.message);
    console.error('[BLOBS] Make sure Netlify Blobs addon is enabled');
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);
  let siteId: string | undefined;
  
  const siteIdIndex = args.indexOf(SITE_ID_FLAG);
  if (siteIdIndex !== -1 && args[siteIdIndex + 1]) {
    siteId = args[siteIdIndex + 1];
    console.log(`[KEYGEN] Using site ID: ${siteId}`);
  }
  
  console.log('=== Quantum-Resistant Key Generation ===\n');
  
  const masterKey = loadOrGenerateMasterKey();
  
  const keys = generateKeys();
  
  console.log('[KEYGEN] Key sizes:');
  console.log(`  - Kyber public:  ${keys.kyber.publicKey.length} hex chars (${Math.round(keys.kyber.publicKey.length/2)} bytes)`);
  console.log(`  - Kyber private: ${keys.kyber.privateKey.length} hex chars (${Math.round(keys.kyber.privateKey.length/2)} bytes)`);
  console.log(`  - RSA public:    ${keys.rsa.publicKey.length} chars`);
  console.log(`  - RSA private:   ${keys.rsa.privateKey.length} chars\n`);
  
  const localKeysDir = join(process.cwd(), '.netlify');
  if (!existsSync(localKeysDir)) {
    mkdirSync(localKeysDir, { recursive: true });
  }
  
  const localKeysPath = join(localKeysDir, 'quantum-keys.json');
  writeFileSync(
    localKeysPath,
    JSON.stringify({
      kyber: {
        publicKey: keys.kyber.publicKey,
        privateKey: keys.kyber.privateKey
      },
      rsa: {
        publicKey: keys.rsa.publicKey,
        privateKey: keys.rsa.privateKey
      },
      generated: new Date().toISOString()
    }, null, 2),
    'utf-8'
  );
  console.log(`[KEYGEN] ✓ Local copy saved to ${localKeysPath}`);
  
  console.log('');
  registerKeysToNetlify(keys.kyber.publicKey, keys.kyber.privateKey, keys.rsa.publicKey, keys.rsa.privateKey, masterKey, siteId);
  
  console.log('\n=== Key Generation Complete ===');
  console.log('Public keys: Netlify env vars (KYBER_PUBLIC_KEY, RSA_PUBLIC_KEY_B64)');
  console.log('Master key: Netlify env var QUANTUM_MASTER_KEY + .netlify/master-key.txt (local)');
  console.log('Private keys: Netlify Blobs quantum-keys store (AES-256-GCM encrypted)');
  console.log('Local dev keys: .netlify/quantum-keys.json (git-ignored)');
  console.log('\nYou can now deploy your site to activate the encryption.');
}

main();
