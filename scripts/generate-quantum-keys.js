#!/usr/bin/env node
/**
 * Generate Quantum-Resistant (ML-KEM-768) + RSA keys for registry encryption
 *
 * This script:
 * 1. Generates ML-KEM-768 keypair (post-quantum, NIST FIPS 203)
 * 2. Generates RSA-4096 keypair (classical)
 * 3. Saves public keys to source code (constants)
 * 4. Registers private keys to Netlify env vars via CLI
 *
 * Usage:
 *   node --loader ts-node/esm scripts/generate-quantum-keys.ts [--site-id NETLIFY_SITE_ID]
 */
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { generateKeyPairSync } from 'crypto';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
const SITE_ID_FLAG = '--site-id';
function generateKeys() {
    console.log('[KEYGEN] Generating ML-KEM-768 keypair (NIST FIPS 203)...');
    const kyberKeys = ml_kem768.keygen();
    console.log('[KEYGEN] Generating RSA-4096 keypair...');
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
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
            publicKey: Buffer.from(kyberKeys.publicKey).toString('hex'),
            privateKey: Buffer.from(kyberKeys.secretKey).toString('hex')
        },
        rsa: {
            publicKey: publicKey,
            privateKey: privateKey
        }
    };
}
function savePublicKeysToSource(kyberPubKey, rsaPubKey) {
    const constantsPath = join(process.cwd(), 'netlify', 'functions', '_shared', 'quantumKeys.ts');
    const content = `// Auto-generated quantum-resistant encryption keys (PUBLIC KEYS ONLY)
// Generated: ${new Date().toISOString()}
// DO NOT EDIT MANUALLY - Use scripts/generate-quantum-keys.ts

export const KYBER_PUBLIC_KEY = '${kyberPubKey}';

export const RSA_PUBLIC_KEY = \`${rsaPubKey.trim()}\`;
`;
    writeFileSync(constantsPath, content, 'utf-8');
    console.log(`[KEYGEN] ✓ Public keys saved to ${constantsPath}`);
}
function registerPrivateKeysToNetlify(kyberPubKey, kyberPrivKey, rsaPubKey, rsaPrivKey, siteId) {
    console.log('[NETLIFY] Registering ALL keys as environment variables...');
    // Encode RSA keys as base64 to avoid newline issues
    const rsaPubB64 = Buffer.from(rsaPubKey).toString('base64');
    const rsaPrivB64 = Buffer.from(rsaPrivKey).toString('base64');
    const siteFlag = siteId ? `--site-id ${siteId}` : '';
    try {
        // Set Kyber public key
        execSync(`netlify env:set KYBER_PUBLIC_KEY "${kyberPubKey}" ${siteFlag}`, { stdio: 'inherit' });
        console.log('[NETLIFY] ✓ KYBER_PUBLIC_KEY registered');
        // Set Kyber private key
        execSync(`netlify env:set KYBER_PRIVATE_KEY "${kyberPrivKey}" --force ${siteFlag}`, { stdio: 'inherit' });
        console.log('[NETLIFY] ✓ KYBER_PRIVATE_KEY registered');
        // Set RSA public key (base64)
        execSync(`netlify env:set RSA_PUBLIC_KEY_B64 "${rsaPubB64}" ${siteFlag}`, { stdio: 'inherit' });
        console.log('[NETLIFY] ✓ RSA_PUBLIC_KEY_B64 registered');
        // Set RSA private key (base64)
        execSync(`netlify env:set RSA_PRIVATE_KEY_B64 "${rsaPrivB64}" --force ${siteFlag}`, { stdio: 'inherit' });
        console.log('[NETLIFY] ✓ RSA_PRIVATE_KEY_B64 registered');
        console.log('[NETLIFY] ✓ All quantum keys registered successfully (RSA as base64)');
        console.log('[NETLIFY] Note: Keys are set for production. Deploy to activate.');
    }
    catch (error) {
        console.error('[NETLIFY] ✗ Failed to register keys:', error.message);
        console.error('[NETLIFY] Make sure you are authenticated with: netlify login');
        console.error('[NETLIFY] And linked to a site with: netlify link');
        process.exit(1);
    }
}
function main() {
    const args = process.argv.slice(2);
    let siteId;
    // Parse --site-id argument
    const siteIdIndex = args.indexOf(SITE_ID_FLAG);
    if (siteIdIndex !== -1 && args[siteIdIndex + 1]) {
        siteId = args[siteIdIndex + 1];
        console.log(`[KEYGEN] Using site ID: ${siteId}`);
    }
    console.log('=== Quantum-Resistant Key Generation ===\n');
    // Generate keys
    const keys = generateKeys();
    // Save public keys to source
    savePublicKeysToSource(keys.kyber.publicKey, keys.rsa.publicKey);
    // Save local copy for development
    const localKeysDir = join(process.cwd(), '.netlify');
    if (!existsSync(localKeysDir)) {
        mkdirSync(localKeysDir, { recursive: true });
    }
    const localKeysPath = join(localKeysDir, 'quantum-keys.json');
    writeFileSync(localKeysPath, JSON.stringify({
        kyber: {
            publicKey: keys.kyber.publicKey,
            privateKey: keys.kyber.privateKey
        },
        rsa: {
            publicKey: keys.rsa.publicKey,
            privateKey: keys.rsa.privateKey
        },
        generated: new Date().toISOString()
    }, null, 2), 'utf-8');
    console.log(`[KEYGEN] ✓ Local copy saved to ${localKeysPath}`);
    // Register to Netlify (production)
    console.log('');
    registerPrivateKeysToNetlify(keys.kyber.publicKey, keys.kyber.privateKey, keys.rsa.publicKey, keys.rsa.privateKey, siteId);
    console.log('\n=== Key Generation Complete ===');
    console.log('Public keys: netlify/functions/_shared/quantumKeys.ts (AND Netlify env)');
    console.log('Private keys: Netlify environment variables (production)');
    console.log('Local dev keys: .netlify/quantum-keys.json (git-ignored)');
    console.log('\nYou can now deploy your site to activate the encryption.');
}
main();
