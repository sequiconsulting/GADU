import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { initNetlifyBlobs, loadRegistry, logAuditEvent } from './shared/registry';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
} as const;

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' } as const;

function getBearerToken(event: any): string | null {
  const raw = event.headers?.authorization || event.headers?.Authorization;
  if (!raw) return null;
  const token = raw.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

async function requireUserManagementAuth(event: any, lodge: any) {
  const token = getBearerToken(event);
  const adminPassword = process.env.ADMIN_INTERFACE_PASSWORD;

  if (!token) {
    const err: any = new Error('Missing auth token');
    err.statusCode = 401;
    throw err;
  }

  // Admin Console path
  if (adminPassword && token === adminPassword) {
    return { mode: 'admin' as const };
  }

  // Lodge user path (Supabase JWT)
  if (!lodge?.supabaseUrl || !lodge?.supabaseAnonKey) {
    const err: any = new Error('Lodge config incomplete for auth');
    err.statusCode = 500;
    throw err;
  }

  const supabase = createClient(lodge.supabaseUrl, lodge.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    const err: any = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }

  const privileges = (data.user.user_metadata as any)?.privileges || [];
  if (!Array.isArray(privileges) || !privileges.includes('AD')) {
    const err: any = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  return { mode: 'lodge-admin' as const, userId: data.user.id, email: data.user.email };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  initNetlifyBlobs(event);
  // GET - List users
  if (event.httpMethod === 'GET') {
    const lodgeNumber = event.queryStringParameters?.lodge;
    
    if (!lodgeNumber) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Missing lodge parameter' })
      };
    }
    
    try {
      const registry = await loadRegistry();
      const lodge = registry[lodgeNumber];
      
      if (!lodge) {
        return {
          statusCode: 404,
          headers: jsonHeaders,
          body: JSON.stringify({ error: 'Lodge not found' })
        };
      }

      await requireUserManagementAuth(event, lodge);
      
      const supabase = createClient(lodge.supabaseUrl, lodge.supabaseServiceKey);
      const { data: { users }, error } = await supabase.auth.admin.listUsers();
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ success: true, users })
      };
    } catch (error: any) {
      return {
        statusCode: error?.statusCode || 500,
        headers: jsonHeaders,
        body: JSON.stringify({ error: error.message })
      };
    }
  }
  
  // POST - Create/Delete/Update user
  if (event.httpMethod === 'POST') {
    try {
      const { action, lodgeNumber, email, password, metadata, name, privileges, userId } = (event.body ? JSON.parse(event.body) : {}) as any;
      
      const registry = await loadRegistry();
      const lodge = registry[lodgeNumber];
      
      if (!lodge) {
        return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: 'Lodge not found' }) };
      }

      await requireUserManagementAuth(event, lodge);
      
      const supabase = createClient(lodge.supabaseUrl, lodge.supabaseServiceKey);
      
      if (action === 'create') {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            name: name || email,
            privileges: privileges || [],
            mustChangePassword: true,
            ...metadata
          }
        });
        
        if (error) throw error;

        try {
          await logAuditEvent('user_created', { lodgeNumber, email });
        } catch (auditError) {
          console.warn('[MANAGE-USERS] Audit log failed (non-critical):', auditError);
        }
        
        return {
          statusCode: 200,
          headers: jsonHeaders,
          body: JSON.stringify({ success: true, user: data.user })
        };
      }
      
      if (action === 'delete') {
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const user = users?.find((u: any) => u.email === email);
        
        if (!user) {
          return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: 'User not found' }) };
        }
        
        const { error } = await supabase.auth.admin.deleteUser(user.id);
        if (error) throw error;

        try {
          await logAuditEvent('user_deleted', { lodgeNumber, email });
        } catch (auditError) {
          console.warn('[MANAGE-USERS] Audit log failed (non-critical):', auditError);
        }
        
        return {
          statusCode: 200,
          headers: jsonHeaders,
          body: JSON.stringify({ success: true })
        };
      }
      
      if (action === 'updatePassword') {
        if (!userId) {
          return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing userId' }) };
        }
        
        const { error } = await supabase.auth.admin.updateUserById(userId, {
          password,
          user_metadata: {
            mustChangePassword: false
          }
        });
        
        if (error) throw error;

        try {
          await logAuditEvent('user_password_changed', { lodgeNumber, email });
        } catch (auditError) {
          console.warn('[MANAGE-USERS] Audit log failed (non-critical):', auditError);
        }

        return {
          statusCode: 200,
          headers: jsonHeaders,
          body: JSON.stringify({ success: true })
        };
      }

      if (action === 'updatePrivileges') {
        if (!userId) {
          return {
            statusCode: 400,
            headers: jsonHeaders,
            body: JSON.stringify({ error: 'Missing userId' })
          };
        }
        
        const { data: { user }, error: getError } = await supabase.auth.admin.getUserById(userId);
        
        if (getError || !user) {
          return {
            statusCode: 404,
            headers: jsonHeaders,
            body: JSON.stringify({ error: 'User not found' })
          };
        }
        
        const { error } = await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...user.user_metadata,
            name: name || user.user_metadata?.name || email,
            privileges: privileges || []
          }
        });
        
        if (error) throw error;

        try {
          await logAuditEvent('user_privileges_updated', { lodgeNumber, email, privileges });
        } catch (auditError) {
          console.warn('[MANAGE-USERS] Audit log failed (non-critical):', auditError);
        }
        
        return {
          statusCode: 200,
          headers: jsonHeaders,
          body: JSON.stringify({ success: true })
        };
      }

      if (action === 'clearMustChangePassword') {
        if (!userId) {
          return {
            statusCode: 400,
            headers: jsonHeaders,
            body: JSON.stringify({ error: 'Missing userId' })
          };
        }
        
        const { data: { user }, error: getError } = await supabase.auth.admin.getUserById(userId);
        
        if (getError || !user) {
          return {
            statusCode: 404,
            headers: jsonHeaders,
            body: JSON.stringify({ error: 'User not found' })
          };
        }
        
        const { error } = await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...user.user_metadata,
            mustChangePassword: false
          }
        });
        
        if (error) throw error;

        try {
          await logAuditEvent('user_password_changed', { lodgeNumber, userId });
        } catch (auditError) {
          console.warn('[MANAGE-USERS] Audit log failed (non-critical):', auditError);
        }
        
        return {
          statusCode: 200,
          headers: jsonHeaders,
          body: JSON.stringify({ success: true })
        };
      }
      
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Invalid action' })
      };
    } catch (error: any) {
      return {
        statusCode: error?.statusCode || 500,
        headers: jsonHeaders,
        body: JSON.stringify({ error: error.message })
      };
    }
  }
  
  return {
    statusCode: 405,
    headers: jsonHeaders,
    body: JSON.stringify({ error: 'Method Not Allowed' })
  };
};
