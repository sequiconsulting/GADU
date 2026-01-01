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

export default async (request: Request) => {
  try {
    const url = new URL(request.url);
    const glriNumber = url.searchParams.get('glriNumber') || url.searchParams.get('number');
    
    if (!glriNumber) {
      return new Response('Missing glriNumber parameter', { status: 400 });
    }
    
    let registry = await loadRegistry();
    
    // Auto-seed 9999 if registry is empty and 9999 is requested
    if (Object.keys(registry).length === 0 && glriNumber === '9999') {
      registry['9999'] = DEMO_LODGE_CONFIG;
      await saveRegistry(registry);
    }
    
    const lodge = registry[glriNumber];
    
    if (!lodge) {
      return new Response('Lodge not found', { status: 404 });
    }
    
    // Remove service key before sending to client
    const publicConfig: PublicLodgeConfig = {
      glriNumber: lodge.glriNumber,
      lodgeName: lodge.lodgeName,
      province: lodge.province,
      supabaseUrl: lodge.supabaseUrl,
      supabaseAnonKey: lodge.supabaseAnonKey
    };
    
    return new Response(JSON.stringify(publicConfig), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
