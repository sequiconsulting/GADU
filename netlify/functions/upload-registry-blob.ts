/**
 * Netlify Function: Upload and refresh registry to Blobs
 * 
 * This function uploads the encrypted registry to Netlify Blobs
 * and replaces the old one.
 * 
 * Usage:
 *   curl -X POST https://your-site.netlify.app/.netlify/functions/upload-registry-blob
 */

import { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const expectedToken = process.env.REGISTRY_UPLOAD_TOKEN;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { encryptedData, lodgeNumber = '9999' } = body as any;

    if (!encryptedData) {
      return { statusCode: 400, body: 'Missing encryptedData in request body' };
    }

    console.log(`[UPLOAD] Uploading encrypted registry for lodge ${lodgeNumber}...`);

    const store = getStore('gadu-registry');
    
    await store.set('lodges', encryptedData, {
      metadata: {
        lastUpdate: new Date().toISOString(),
        encrypted: 'quantum-hybrid',
        format: 'v2',
        lodgeCount: 1,
        includedLodges: [lodgeNumber],
      },
    });

    console.log('[UPLOAD] ✓ Registry blob uploaded successfully');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Registry uploaded to Blobs',
        size: encryptedData.length,
        lodges: [lodgeNumber],
        encrypted: 'quantum-hybrid',
        format: 'v2',
      })
    };
  } catch (error: any) {
    console.error('[UPLOAD] Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message,
        details: error.toString(),
      })
    };
  }
};
