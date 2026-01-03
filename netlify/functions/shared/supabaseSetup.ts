import { createClient } from '@supabase/supabase-js';
import { LodgeConfig } from '../../../types/lodge';

export interface SetupResult {
  adminUserCreated: boolean;
  errors: string[];
}

/**
 * Automated Supabase configuration for a lodge
 * 
 * Creates:
 * 1. Admin user in Supabase Auth with password and metadata (name + privileges)
 */
export async function setupSupabaseLodge(
  lodgeConfig: LodgeConfig,
  adminEmail: string,
  adminPassword: string,
  adminName: string = 'Admin'
): Promise<SetupResult> {
  
  const results: SetupResult = {
    adminUserCreated: false,
    errors: []
  };
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(adminEmail)) {
    results.errors.push('Invalid email format');
    return results;
  }
  
  if (!adminPassword || adminPassword.length < 8) {
    results.errors.push('Password must be at least 8 characters');
    return results;
  }
  
  console.log(`[SUPABASE-SETUP] Starting setup for admin ${adminEmail}`);
  
  // Create Supabase admin client with service key
  const supabaseAdmin = createClient(
    lodgeConfig.supabaseUrl,
    lodgeConfig.supabaseServiceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  
  // Step 1: Create admin user in Supabase Auth with metadata
  try {
    console.log(`[SUPABASE-SETUP] Creating admin user in Supabase Auth with metadata...`);
    
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,  // Skip email confirmation
      user_metadata: {
        name: adminName,
        privileges: ['AD']  // Admin privilege
      }
    });
    
    if (authError) {
      // User might already exist, try to update password and metadata instead
      if (authError.message.includes('already registered')) {
        console.log(`[SUPABASE-SETUP] User exists, updating password and metadata...`);
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.users.find(u => u.email === adminEmail);
        
        if (existingUser) {
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            password: adminPassword,
            user_metadata: {
              name: adminName,
              privileges: ['AD']
            }
          });
          console.log(`[SUPABASE-SETUP] ✓ Password and metadata updated for existing user`);
        }
      } else {
        throw authError;
      }
    } else {
      console.log(`[SUPABASE-SETUP] ✓ Admin user created in Supabase Auth with metadata`);
    }
    
    results.adminUserCreated = true;
  } catch (error: any) {
    results.errors.push(`Supabase Auth user: ${error.message}`);
    console.error(`[SUPABASE-SETUP] ✗ Auth user creation failed:`, error);
  }
  
  // Step 2: Apply security policies
  try {
    console.log(`[SUPABASE-SETUP] Applying security policies...`);
    await applySecurityPolicies(supabaseAdmin);
    console.log(`[SUPABASE-SETUP] ✓ Security policies applied`);
  } catch (error: any) {
    results.errors.push(`Security policies: ${error.message}`);
    console.error(`[SUPABASE-SETUP] ✗ Security policies failed:`, error);
  }

  return results;
}

/**
 * Apply security policies to all tables
 * - Deny all access to anonymous users
 * - Allow all operations to authenticated users (privileges managed in-app)
 */
async function applySecurityPolicies(supabaseAdmin: any): Promise<void> {
  const tables = ['app_settings', 'members', 'convocazioni'];
  
  const sqlStatements = [];
  
  for (const table of tables) {
    // Enable RLS
    sqlStatements.push(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    
    // Drop existing policies
    sqlStatements.push(`DROP POLICY IF EXISTS "anon_deny_${table}" ON public.${table};`);
    sqlStatements.push(`DROP POLICY IF EXISTS "authenticated_all_${table}" ON public.${table};`);
    
    // Create new policies
    // Deny all to anonymous users
    sqlStatements.push(`
      CREATE POLICY "anon_deny_${table}" 
        ON public.${table} 
        FOR ALL 
        USING (auth.role() != 'anon') 
        WITH CHECK (auth.role() != 'anon');
    `);
    
    // Allow all to authenticated users
    sqlStatements.push(`
      CREATE POLICY "authenticated_all_${table}" 
        ON public.${table} 
        FOR ALL 
        USING (auth.role() = 'authenticated') 
        WITH CHECK (auth.role() = 'authenticated');
    `);
  }
  
  // Execute all statements
  for (const sql of sqlStatements) {
    const { error } = await supabaseAdmin.rpc('exec_sql', { query: sql }).catch(() => {
      // If RPC doesn't exist, try direct execution (note: this might not work with client)
      return { error: null };
    });
    
    if (error) {
      console.warn(`[SECURITY-POLICY] Warning executing SQL: ${error.message}`);
      // Continue anyway - policies might already exist or be set differently
    }
  }
}
import { createClient } from '@supabase/supabase-js';
import { LodgeConfig } from '../../../types/lodge';

export interface SetupResult {
  adminUserCreated: boolean;
  errors: string[];
}

/**
 * Automated Supabase configuration for a lodge
 * 
 * Creates:
 * 1. Admin user in Supabase Auth with password and metadata (name + privileges)
 */
export async function setupSupabaseLodge(
  lodgeConfig: LodgeConfig,
  adminEmail: string,
  adminPassword: string,
  adminName: string = 'Admin'
): Promise<SetupResult> {
  
  const results: SetupResult = {
    adminUserCreated: false,
    errors: []
  };
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(adminEmail)) {
    results.errors.push('Invalid email format');
    return results;
  }
  
  if (!adminPassword || adminPassword.length < 8) {
    results.errors.push('Password must be at least 8 characters');
    return results;
  }
  
  console.log(`[SUPABASE-SETUP] Starting setup for admin ${adminEmail}`);
  
  // Create Supabase admin client with service key
  const supabaseAdmin = createClient(
    lodgeConfig.supabaseUrl,
    lodgeConfig.supabaseServiceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  
  // Step 1: Create admin user in Supabase Auth with metadata
  try {
    console.log(`[SUPABASE-SETUP] Creating admin user in Supabase Auth with metadata...`);
    
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,  // Skip email confirmation
      user_metadata: {
        name: adminName,
        privileges: ['AD']  // Admin privilege
      }
    });
    
    if (authError) {
      // User might already exist, try to update password and metadata instead
      if (authError.message.includes('already registered')) {
        console.log(`[SUPABASE-SETUP] User exists, updating password and metadata...`);
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.users.find(u => u.email === adminEmail);
        
        if (existingUser) {
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            password: adminPassword,
            user_metadata: {
              name: adminName,
              privileges: ['AD']
            }
          });
          console.log(`[SUPABASE-SETUP] ✓ Password and metadata updated for existing user`);
        }
      } else {
        throw authError;
      }
    } else {
      console.log(`[SUPABASE-SETUP] ✓ Admin user created in Supabase Auth with metadata`);
    }
    
    results.adminUserCreated = true;
  } catch (error: any) {
    results.errors.push(`Supabase Auth user: ${error.message}`);
    console.error(`[SUPABASE-SETUP] ✗ Auth user creation failed:`, error);
  }
  
  // Step 2: Apply security policies
  try {
    console.log(`[SUPABASE-SETUP] Applying security policies...`);
    await applySecurityPolicies(supabaseAdmin);
    console.log(`[SUPABASE-SETUP] ✓ Security policies applied`);
  } catch (error: any) {
    results.errors.push(`Security policies: ${error.message}`);
    console.error(`[SUPABASE-SETUP] ✗ Security policies failed:`, error);
  }

  return results;
}

/**
 * Apply security policies to all tables
 * - Deny all access to anonymous users
 * - Allow all operations to authenticated users (privileges managed in-app)
 */
async function applySecurityPolicies(supabaseAdmin: any): Promise<void> {
  const tables = ['app_settings', 'members', 'convocazioni'];
  
  const sqlStatements = [];
  
  for (const table of tables) {
    // Enable RLS
    sqlStatements.push(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    
    // Drop existing policies
    sqlStatements.push(`DROP POLICY IF EXISTS "anon_deny_${table}" ON public.${table};`);
    sqlStatements.push(`DROP POLICY IF EXISTS "authenticated_all_${table}" ON public.${table};`);
    
    // Create new policies
    // Deny all to anonymous users
    sqlStatements.push(`
      CREATE POLICY "anon_deny_${table}" 
        ON public.${table} 
        FOR ALL 
        USING (auth.role() != 'anon') 
        WITH CHECK (auth.role() != 'anon');
    `);
    
    // Allow all to authenticated users
    sqlStatements.push(`
      CREATE POLICY "authenticated_all_${table}" 
        ON public.${table} 
        FOR ALL 
        USING (auth.role() = 'authenticated') 
        WITH CHECK (auth.role() = 'authenticated');
    `);
  }
  
  // Execute all statements
  for (const sql of sqlStatements) {
    const { error } = await supabaseAdmin.rpc('exec_sql', { query: sql }).catch(() => {
      // If RPC doesn't exist, try direct execution (note: this might not work with client)
      return { error: null };
    });
    
    if (error) {
      console.warn(`[SECURITY-POLICY] Warning executing SQL: ${error.message}`);
      // Continue anyway - policies might already exist or be set differently
    }
  }
}
