import { Handler } from '@netlify/functions';
import { loadRegistry, logAuditEvent } from './shared/registry';
import { setupSupabaseLodge } from './shared/supabaseSetup';

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

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  try {
    const { glriNumber, adminEmail, adminPassword, adminName } = (event.body ? JSON.parse(event.body) : {}) as SetupRequest;
    
    if (!glriNumber || !adminEmail || !adminPassword) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: glriNumber, adminEmail, adminPassword' })
      };
    }
    
    // Load registry
    const registry = await loadRegistry();
    const lodgeConfig = registry[glriNumber];
    
    if (!lodgeConfig) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Lodge ${glriNumber} not found in registry` })
      };
    }
    
    console.log(`[SUPABASE-SETUP] Starting setup for lodge ${glriNumber}`);
    
    // Run setup using shared function
    const results = await setupSupabaseLodge(
      lodgeConfig,
      adminEmail,
      adminPassword,
      adminName || 'Admin'
    );
    
    // Log audit event (non bloccare il flusso se audit fallisce)
    try {
      await logAuditEvent('supabase_setup', {
        glriNumber,
        adminEmail,
        results
      });
    } catch (auditError) {
      console.warn('[SUPABASE-SETUP] Audit log failed (non-critical):', auditError);
    }
    
    // Determine response status
    const allSuccess = results.adminUserCreated && results.errors.length === 0;
    
    if (allSuccess) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Supabase setup completed successfully',
          results
        })
      };
    } else if (results.adminUserCreated) {
      return {
        statusCode: 207,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Supabase setup completed with warnings',
          results
        })
      };
    } else {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Supabase setup failed',
          results
        })
      };
    }
    
  } catch (error: any) {
    console.error('[SUPABASE-SETUP] Unexpected error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
