import { createClient } from '@supabase/supabase-js';
import { loadRegistry, logAuditEvent } from './_shared/registry';

export default async (request: Request) => {
  // GET - List users
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const lodgeNumber = url.searchParams.get('lodge');
    
    if (!lodgeNumber) {
      return new Response(
        JSON.stringify({ error: 'Missing lodge parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    try {
      const registry = await loadRegistry();
      const lodge = registry[lodgeNumber];
      
      if (!lodge) {
        return new Response(
          JSON.stringify({ error: 'Lodge not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      const supabase = createClient(lodge.supabaseUrl, lodge.supabaseServiceKey);
      const { data: { users }, error } = await supabase.auth.admin.listUsers();
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, users }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  
  // POST - Create/Delete/Update user
  if (request.method === 'POST') {
    try {
      const { action, lodgeNumber, email, password, metadata, name, privileges, userId } = await request.json() as any;
      
      const registry = await loadRegistry();
      const lodge = registry[lodgeNumber];
      
      if (!lodge) {
        return new Response('Lodge not found', { status: 404 });
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
        
        await logAuditEvent('user_created', { lodgeNumber, email });
        
        return new Response(
          JSON.stringify({ success: true, user: data.user }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      if (action === 'delete') {
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const user = users?.find((u: any) => u.email === email);
        
        if (!user) {
          return new Response('User not found', { status: 404 });
        }
        
        const { error } = await supabase.auth.admin.deleteUser(user.id);
        if (error) throw error;
        
        await logAuditEvent('user_deleted', { lodgeNumber, email });
        
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      if (action === 'updatePassword') {
        if (!userId) {
          return new Response('Missing userId', { status: 400 });
        }
        
        const { error } = await supabase.auth.admin.updateUserById(userId, {
          password,
          user_metadata: {
            mustChangePassword: false
          }
        });
        
        if (error) throw error;
        
        await logAuditEvent('user_password_changed', { lodgeNumber, email });
        
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      if (action === 'updatePrivileges') {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Missing userId' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        const { data: { user }, error: getError } = await supabase.auth.admin.getUserById(userId);
        
        if (getError || !user) {
          return new Response(
            JSON.stringify({ error: 'User not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        const { error } = await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...user.user_metadata,
            name: name || user.user_metadata?.name || email,
            privileges: privileges || []
          }
        });
        
        if (error) throw error;
        
        await logAuditEvent('user_privileges_updated', { lodgeNumber, email, privileges });
        
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'clearMustChangePassword') {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Missing userId' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        const { data: { user }, error: getError } = await supabase.auth.admin.getUserById(userId);
        
        if (getError || !user) {
          return new Response(
            JSON.stringify({ error: 'User not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        const { error } = await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...user.user_metadata,
            mustChangePassword: false
          }
        });
        
        if (error) throw error;
        
        await logAuditEvent('user_password_changed', { lodgeNumber, userId });
        
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  
  return new Response(
    JSON.stringify({ error: 'Method Not Allowed' }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
};
