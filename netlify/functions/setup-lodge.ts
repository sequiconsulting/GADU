import { Handler } from '@netlify/functions';
import { loadRegistry, saveRegistry, logAuditEvent } from './shared/registry';
import { setupSupabaseLodge } from './shared/supabaseSetup';
import { LodgeConfig } from '../../types/lodge';

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
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
      databasePassword,
      adminEmail,
      adminPassword,
      adminName
    } = body as any;

    if (!glriNumber || !lodgeName || !supabaseUrl || !supabaseServiceKey || !databasePassword) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    const registry = await loadRegistry();

    console.log(`[SETUP-LODGE] Attempting to register lodge ${glriNumber}`);
    console.log(`[SETUP-LODGE] Registry keys: ${Object.keys(registry).join(', ')}`);

    if (registry[glriNumber]) {
      console.log(`[SETUP-LODGE] Lodge ${glriNumber} already exists in registry`);
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Lodge number already registered' })
      };
    }

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
      supabaseServiceKey,
      databasePassword,
      createdAt: new Date(),
      lastAccess: new Date(),
      isActive: true,
      adminEmail
    };

    registry[glriNumber] = lodgeConfig;
    await saveRegistry(registry);
    try {
      await logAuditEvent('lodge_created', { glriNumber, lodgeName });
    } catch (auditError) {
      console.warn('[SETUP-LODGE] Audit log failed (non-critical):', auditError);
    }

    let supabaseSetupResults = null;
    if (adminEmail && adminPassword) {
      console.log(`[SETUP-LODGE] Running automatic Supabase setup for ${glriNumber}...`);
      supabaseSetupResults = await setupSupabaseLodge(
        lodgeConfig,
        adminEmail,
        adminPassword,
        adminName || 'Admin'
      );
      console.log('[SETUP-LODGE] Supabase setup results:', supabaseSetupResults);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        supabaseSetup: supabaseSetupResults
      })
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
