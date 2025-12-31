import { Handler } from '@netlify/functions';
import { loadRegistry, saveRegistry, logAuditEvent } from './_shared/registry';
import { LodgeConfig } from '../../types/lodge';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  try {
    const {
      glriNumber,
      lodgeName,
      province,
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceKey,
      adminEmail
    } = JSON.parse(event.body || '{}');
    
    // Validate
    if (!glriNumber || !lodgeName || !supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }
    
    const registry = await loadRegistry();
    
    // Check if already exists
    if (registry[glriNumber]) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Lodge number already registered' })
      };
    }
    
    // Create config
    const lodgeConfig: LodgeConfig = {
      glriNumber,
      lodgeName,
      province,
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceKey, // Encrypted in production
      createdAt: new Date(),
      lastAccess: new Date(),
      isActive: true,
      adminEmail
    };
    
    registry[glriNumber] = lodgeConfig;
    await saveRegistry(registry);
    await logAuditEvent('lodge_created', { glriNumber, lodgeName });
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
