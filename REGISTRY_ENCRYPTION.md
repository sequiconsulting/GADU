# Registry Quantum Encryption & Deployment

This document describes how to migrate and deploy the encrypted registry to Netlify Blobs in production.

## Overview

The registry is encrypted with a quantum-resistant hybrid encryption scheme:
- **ML-KEM-768** (post-quantum key encapsulation)
- **RSA-4096** (classical key protection)
- **AES-256-GCM** (symmetric data encryption)

Format: `v2:kyber_ciphertext:rsa_encrypted_key:iv:authTag:aes_encrypted_data`

## Local Development

### Generate Keys
```bash
npx tsx scripts/generate-quantum-keys.ts
```

This creates:
- `.netlify/quantum-keys.json` (plaintext keys for dev)
- `.netlify/master-key.txt` (master key for local testing)

### Encrypt Registry Locally
```bash
npx tsx scripts/migrate-registry-to-prod.ts
```

This creates `.netlify/registry-encrypted.txt` with the encrypted registry ready for production.

## Production Deployment

### Step 1: Set Environment Variables on Netlify

```bash
# Set these in your Netlify Site Settings > Build & Deploy > Environment:

KYBER_PUBLIC_KEY=<public-key-hex>
RSA_PUBLIC_KEY_B64=<base64-encoded-public-key>
QUANTUM_MASTER_KEY=<master-key-hex>
REGISTRY_UPLOAD_TOKEN=<secure-random-token>
SITE_URL=<your-netlify-site-url>
```

### Step 2: Upload the Encrypted Registry

#### Option A: Using Netlify CLI
```bash
NETLIFY_AUTH_TOKEN=<your-token> npx netlify blobs:set gadu-registry lodges < .netlify/registry-encrypted.txt
```

#### Option B: Using the Upload Function
```bash
REGISTRY_UPLOAD_TOKEN=<your-token> \
SITE_URL=<your-site-url> \
npx tsx scripts/upload-registry-blob.ts .netlify/registry-encrypted.txt
```

#### Option C: Manual via Netlify UI
1. Go to your site's Netlify dashboard
2. Navigate to Blobs section (if available)
3. Create a new blob store called `gadu-registry`
4. Upload the encrypted registry content as key `lodges`

### Step 3: Verify Deployment

The registry will automatically decrypt on first load:

```bash
# The decrypt function will:
# 1. Fetch the encrypted blob from Netlify
# 2. Decrypt with RSA (protected AES key)
# 3. Decapsulate with ML-KEM (recover AES key)
# 4. Decrypt data with AES-256-GCM
```

## File Structure

```
scripts/
├── generate-quantum-keys.ts      # Generate ML-KEM + RSA keypairs
├── migrate-registry-to-prod.ts   # Encrypt local registry
└── upload-registry-blob.ts       # Upload to Netlify Blobs

netlify/functions/
├── shared/registry.ts            # Core encryption/decryption + Blobs I/O
└── upload-registry-blob.ts       # HTTP endpoint for blob upload

.netlify/
├── quantum-keys.json             # Plaintext keys (local dev only)
├── master-key.txt                # Master key (local dev only)
├── registry.json                 # Plaintext registry (local only)
└── registry-encrypted.txt        # Encrypted registry (ready for prod)
```

## Security Notes

### Local Development (`NETLIFY_DEV`)
- Encryption is **disabled** - data stored as plaintext
- Use for development/testing only
- `.netlify/quantum-keys.json` is Git-ignored

### Production (`Netlify Functions`)
- Encryption is **mandatory** - all data stored as v2 format
- Private keys stored encrypted in Netlify Blobs (`quantum-keys/private-keys`)
- Master key decryption happens at runtime
- Public keys in environment variables

### Key Rotation
To rotate keys in production:
1. Generate new keypair: `npx tsx scripts/generate-quantum-keys.ts`
2. Update environment variables on Netlify
3. Re-encrypt registry: `npx tsx scripts/migrate-registry-to-prod.ts`
4. Upload new blob: `npx tsx scripts/upload-registry-blob.ts`

## Troubleshooting

### "Quantum keys not available"
- Check that `KYBER_PUBLIC_KEY` and `RSA_PUBLIC_KEY_B64` are set in environment
- Verify Netlify Blobs are configured
- Check that `quantum-keys/private-keys` blob exists and is properly encrypted

### "Invalid v2 format"
- Ensure encrypted registry file starts with `v2:`
- Verify file has exactly 6 colon-separated parts
- Use `npx tsx scripts/migrate-registry-to-prod.ts` to regenerate

### "Decryption failed"
- Check master key in `QUANTUM_MASTER_KEY` matches the one used for encryption
- Verify private keys were encrypted with the same master key
- Check RSA/Kyber keypairs are valid

## References

- ML-KEM (NIST FIPS 203): https://csrc.nist.gov/pubs/fips/203/final
- @noble/post-quantum: https://github.com/paulmillr/noble-post-quantum
- Netlify Blobs: https://docs.netlify.com/blobs/overview/
