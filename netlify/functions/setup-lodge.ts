import { loadRegistry, saveRegistry, logAuditEvent } from './_shared/registry';
import { LodgeConfig } from '../../types/lodge';

export default async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  
  try {
    const {
      glriNumber,
      lodgeName,
      province,
      associationName,
      address,
      zipCode,
      city,
      taxCode,
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceKey,
      adminEmail
    } = await request.json() as any;
    
    // Validate
    if (!glriNumber || !lodgeName || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const registry = await loadRegistry();
    
    console.log(`[SETUP-LODGE] Attempting to register lodge ${glriNumber}`);
    console.log(`[SETUP-LODGE] Registry keys: ${Object.keys(registry).join(', ')}`);
    
    // Check if already exists
    if (registry[glriNumber]) {
      console.log(`[SETUP-LODGE] Lodge ${glriNumber} already exists in registry`);
      return new Response(
        JSON.stringify({ error: 'Lodge number already registered' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Create config
    const lodgeConfig: LodgeConfig = {
      glriNumber,
      lodgeName,
      province,
      associationName,
      address,
      zipCode,
      city,
      taxCode,
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
    
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
