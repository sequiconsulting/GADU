import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { initNetlifyBlobs, loadRegistry, logAuditEvent } from './shared/registry';

const jsonHeaders = { 'Content-Type': 'application/json' } as const;

export const handler: Handler = async (event) => {
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
        statusCode: 500,
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
        return { statusCode: 404, body: 'Lodge not found' };
      }
      
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
          return { statusCode: 404, body: 'User not found' };
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
          return { statusCode: 400, body: 'Missing userId' };
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
        statusCode: 500,
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
