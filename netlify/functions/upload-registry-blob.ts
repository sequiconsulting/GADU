/**
 * Netlify Function: Upload and refresh registry to Blobs
 * 
 * This function uploads the encrypted registry to Netlify Blobs
 * and replaces the old one.
 * 
 * Usage:
 *   curl -X POST https://your-site.netlify.app/.netlify/functions/upload-registry-blob
 */

import { getStore } from '@netlify/blobs';

export default async (req: Request) => {
  // Only allow POST from localhost or with auth token
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.REGISTRY_UPLOAD_TOKEN;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json() as any;
    const { encryptedData, lodgeNumber = '9999' } = body;

    if (!encryptedData) {
      return new Response('Missing encryptedData in request body', { status: 400 });
    }

    console.log(`[UPLOAD] Uploading encrypted registry for lodge ${lodgeNumber}...`);

    const store = getStore('gadu-registry');
    
    // Upload the encrypted registry blob
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

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Registry uploaded to Blobs',
        size: encryptedData.length,
        lodges: [lodgeNumber],
        encrypted: 'quantum-hybrid',
        format: 'v2',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[UPLOAD] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
