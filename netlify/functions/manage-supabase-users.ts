import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { loadRegistry, logAuditEvent } from './_shared/registry';

export const handler: Handler = async (event) => {
  // GET - List users
  if (event.httpMethod === 'GET') {
    const lodgeNumber = event.queryStringParameters?.lodge;
    if (!lodgeNumber) {
      return { statusCode: 400, body: 'Missing lodge parameter' };
    }
    
    try {
      const registry = await loadRegistry();
      const lodge = registry[lodgeNumber];
      
      if (!lodge) {
        return { statusCode: 404, body: 'Lodge not found' };
      }
      
      const supabase = createClient(lodge.supabaseUrl, lodge.supabaseServiceKey);
      const { data: { users }, error } = await supabase.auth.admin.listUsers();
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, users })
      };
    } catch (error: any) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  }
  
  // POST - Create/Delete/Update user
  if (event.httpMethod === 'POST') {
    try {
      const { action, lodgeNumber, email, password, metadata } = JSON.parse(event.body || '{}');
      
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
          user_metadata: metadata || {}
        });
        
        if (error) throw error;
        
        await logAuditEvent('user_created', { lodgeNumber, email });
        
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, user: data.user })
        };
      }
      
      if (action === 'delete') {
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const user = users?.find(u => u.email === email);
        
        if (!user) {
          return { statusCode: 404, body: 'User not found' };
        }
        
        const { error } = await supabase.auth.admin.deleteUser(user.id);
        if (error) throw error;
        
        await logAuditEvent('user_deleted', { lodgeNumber, email });
        
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true })
        };
      }
      
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid action' })
      };
    } catch (error: any) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  }
  
  return { statusCode: 405, body: 'Method Not Allowed' };
};
