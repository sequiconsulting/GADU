import { createClient } from '@supabase/supabase-js';
import { loadRegistry, logAuditEvent } from './_shared/registry';

export default async (request: Request) => {
  // GET - List users
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const lodgeNumber = url.searchParams.get('lodge');
    
    if (!lodgeNumber) {
      return new Response('Missing lodge parameter', { status: 400 });
    }
    
    try {
      const registry = await loadRegistry();
      const lodge = registry[lodgeNumber];
      
      if (!lodge) {
        return new Response('Lodge not found', { status: 404 });
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
      const { action, lodgeNumber, email, password, metadata } = await request.json() as any;
      
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
          user_metadata: metadata || {}
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
  
  return new Response('Method Not Allowed', { status: 405 });
};
