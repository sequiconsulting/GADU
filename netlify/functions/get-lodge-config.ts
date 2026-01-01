import { Handler } from '@netlify/functions';
import { loadRegistry, saveRegistry } from './_shared/registry';
import { PublicLodgeConfig } from '../../types/lodge';

const DEMO_LODGE_CONFIG = {
  glriNumber: '9999',
  lodgeName: 'Demo Loggia',
  province: 'Demo',
  supabaseUrl: 'https://jqelokmsjosjwmrbwnyz.supabase.co',
  supabaseAnonKey: 'sb_publishable_OB7Uozbjy1Fc7z5QpOjGAA_SpS-TuFt',
  supabaseServiceKey: 'sb_secret_IUc5DhRQ5c5cFvzYSaqDRg_JwglMFsi',
  createdAt: new Date(),
  lastAccess: new Date(),
  isActive: true,
  adminEmail: 'admin@gadu.app'
};

export const handler: Handler = async (event) => {
  const glriNumber = event.queryStringParameters?.glriNumber || event.queryStringParameters?.number;
  
  if (!glriNumber) {
    return { statusCode: 400, body: 'Missing glriNumber parameter' };
  }
  
  try {
    let registry = await loadRegistry();
    
    // Auto-seed 9999 if registry is empty and 9999 is requested
    if (Object.keys(registry).length === 0 && glriNumber === '9999') {
      registry['9999'] = DEMO_LODGE_CONFIG;
      await saveRegistry(registry);
    }
    
    const lodge = registry[glriNumber];
    
    if (!lodge) {
      return { statusCode: 404, body: 'Lodge not found' };
    }
    
    // Remove service key before sending to client
    const publicConfig: PublicLodgeConfig = {
      glriNumber: lodge.glriNumber,
      lodgeName: lodge.lodgeName,
      province: lodge.province,
      supabaseUrl: lodge.supabaseUrl,
      supabaseAnonKey: lodge.supabaseAnonKey
    };
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publicConfig)
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
