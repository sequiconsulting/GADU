import { Handler } from '@netlify/functions';
import { createDecipheriv, privateDecrypt, randomBytes } from 'crypto';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

const ALGORITHM = 'aes-256-gcm';

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

interface DecryptedRegistry {
  [key: string]: {
    glriNumber: string;
    lodgeName: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseServiceKey: string;
    databasePassword: string;
  };
}

function decryptDataQuantum(ciphertext: string, quantumKeys: QuantumKeys): string {
  try {
    // Parse format: v2:kyberCiphertext:rsaEncryptedKey:iv:authTag:encryptedData
    const parts = ciphertext.split(':');
    if (parts[0] !== 'v2') {
      throw new Error('Invalid encryption format version');
    }

    const kyberCiphertext = Buffer.from(parts[1], 'hex');
    const rsaEncryptedKey = Buffer.from(parts[2], 'hex');
    const iv = Buffer.from(parts[3], 'hex');
    const authTag = Buffer.from(parts[4], 'hex');
    const encryptedData = parts[5];

    // Step 1: Decrypt RSA-encrypted key with private key
    const rsaPrivateKeyPem = Buffer.from(quantumKeys.rsa.privateKey, 'base64').toString('utf-8');
    const protectedKey = privateDecrypt(
      {
        key: rsaPrivateKeyPem,
        padding: 1, // PKCS1_OAEP_PADDING
      },
      rsaEncryptedKey
    );

    // Step 2: Decapsulate with ML-KEM-768
    const kyberPrivateKey = Buffer.from(quantumKeys.kyber.privateKey, 'hex');
    const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, kyberPrivateKey);

    // Step 3: XOR protected key with shared secret to recover AES key
    const aesKey = Buffer.alloc(protectedKey.length);
    for (let i = 0; i < protectedKey.length; i++) {
      aesKey[i] = protectedKey[i] ^ sharedSecret[i];
    }

    // Step 4: Decrypt data with AES-256-GCM
    const decipher = createDecipheriv(ALGORITHM, aesKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error: any) {
    throw new Error(`Quantum decryption failed: ${error.message}`);
  }
}

const handler: Handler = async (event) => {
  try {
    console.log('[GET-REGISTRY] Decrypting registry blob...');

    // For now, just return a message that the endpoint is available
    // The actual blob is served via HTTP from public/.well-known/gadu-registry.blob
    // On deployment, a decrypt-registry endpoint will be called by the client

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Registry encryption system ready',
        blob_url: '/.well-known/gadu-registry.blob',
        hint: 'Download blob and decrypt with client-side quantum keys',
      }),
    };
  } catch (error: any) {
    console.error('[GET-REGISTRY] Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
};

export { handler };
export { decryptDataQuantum, type DecryptedRegistry };
