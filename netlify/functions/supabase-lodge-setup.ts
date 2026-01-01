import { loadRegistry, logAuditEvent } from './_shared/registry';
import { setupSupabaseLodge } from './_shared/supabaseSetup';

/**
 * Supabase Lodge Setup - Automated configuration
 * 
 * Automatically configures a Supabase project for a lodge:
 * 1. Creates admin user in Supabase Auth with password
 * 2. Adds admin user to app_settings.users table with privileges
 * 
 * Requires:
 * - glriNumber: Lodge GLRI number (must exist in registry)
 * - adminEmail: Email of the admin user to add
 * - adminPassword: Password for the admin user (min 8 characters)
 */

interface SetupRequest {
  glriNumber: string;
  adminEmail: string;
  adminPassword: string;
  adminName?: string;
}

export default async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  
  try {
    const { glriNumber, adminEmail, adminPassword, adminName } = await request.json() as SetupRequest;
    
    if (!glriNumber || !adminEmail || !adminPassword) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: glriNumber, adminEmail, adminPassword' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Load registry
    const registry = await loadRegistry();
    const lodgeConfig = registry[glriNumber];
    
    if (!lodgeConfig) {
      return new Response(
        JSON.stringify({ error: `Lodge ${glriNumber} not found in registry` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[SUPABASE-SETUP] Starting setup for lodge ${glriNumber}`);
    
    // Run setup using shared function
    const results = await setupSupabaseLodge(
      lodgeConfig,
      adminEmail,
      adminPassword,
      adminName || 'Admin'
    );
    
    // Log audit event
    await logAuditEvent('supabase_setup', {
      glriNumber,
      adminEmail,
      results
    });
    
    // Determine response status
    const allSuccess = results.adminUserCreated && results.errors.length === 0;
    
    if (allSuccess) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Supabase setup completed successfully',
          results
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else if (results.adminUserCreated) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Supabase setup completed with warnings',
          results
        }),
        { status: 207, headers: { 'Content-Type': 'application/json' } } // Multi-Status
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Supabase setup failed',
          results
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error: any) {
    console.error('[SUPABASE-SETUP] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
