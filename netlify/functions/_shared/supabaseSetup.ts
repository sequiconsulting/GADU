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
  
  return results;
}
