#!/usr/bin/env node

/**
 * Upload encrypted registry to production Netlify Blobs
 * 
 * Usage:
 *   REGISTRY_UPLOAD_TOKEN=secret npx tsx scripts/upload-registry-blob.ts <encrypted-file-path>
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

async function uploadBlob() {
  const token = process.env.REGISTRY_UPLOAD_TOKEN;
  const siteUrl = process.env.SITE_URL || 'https://gadu-prod.netlify.app';
  const encryptedFilePath = process.argv[2];

  if (!encryptedFilePath) {
    console.error('[ERROR] Usage: npx tsx scripts/upload-registry-blob.ts <path-to-encrypted-file>');
    process.exit(1);
  }

  if (!token) {
    console.error('[ERROR] REGISTRY_UPLOAD_TOKEN environment variable not set');
    process.exit(1);
  }

  try {
    console.log('[UPLOAD] Reading encrypted registry file...');
    const filePath = resolve(process.cwd(), encryptedFilePath);
    const encryptedData = readFileSync(filePath, 'utf-8');
    console.log(`[UPLOAD] Encrypted data loaded: ${encryptedData.length} bytes`);

    // Verify format
    if (!encryptedData.startsWith('v2:')) {
      throw new Error('Invalid format: encrypted data must start with "v2:"');
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 6) {
      throw new Error(`Invalid v2 format: expected 6 parts but got ${parts.length}`);
    }

    console.log('[UPLOAD] Format verified: v2 quantum-hybrid encryption');
    console.log(`[UPLOAD] Uploading to ${siteUrl}/.netlify/functions/upload-registry-blob`);

    const response = await fetch(`${siteUrl}/.netlify/functions/upload-registry-blob`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        encryptedData,
        lodgeNumber: '9999',
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[ERROR] Upload failed:', result);
      process.exit(1);
    }

    console.log('[UPLOAD] ✓ Upload successful!');
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

uploadBlob();
