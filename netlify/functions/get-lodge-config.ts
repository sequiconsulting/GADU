import { loadRegistry } from './shared/registry';
import { PublicLodgeConfig } from '../../types/lodge';

export default async (request: Request) => {
  try {
    const url = new URL(request.url);
    const glriNumber = url.searchParams.get('glriNumber') || url.searchParams.get('number');
    
    if (!glriNumber) {
      return new Response('Missing glriNumber parameter', { status: 400 });
    }
    
    const registry = await loadRegistry();
    console.log(`[GET-LODGE-CONFIG] Looking for lodge ${glriNumber}`);
    console.log(`[GET-LODGE-CONFIG] Registry keys: ${Object.keys(registry).join(', ')}`);
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
