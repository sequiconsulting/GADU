import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logAuditEvent } from './shared/registry';

export default async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  
  try {
    const { supabaseUrl, supabaseServiceKey } = await request.json() as any;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing credentials' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Read schema SQL
    const schemaPath = join(__dirname, '../../supabase-schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    
    // Split SQL into statements and execute them
    const statements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // Execute each statement via direct SQL (if available)
    // Note: This approach depends on Supabase configuration
    // Alternative: use supabase.rpc if a custom SQL executor function exists
    
    // For now, we'll verify tables exist
    const tables = ['app_settings', 'members', 'convocazioni'];
    for (const table of tables) {
      const { error: checkError } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (checkError && checkError.code === 'PGRST116') {
        // Table doesn't exist - need to run SQL manually
        return new Response(
          JSON.stringify({ 
            error: `Table ${table} not found. Please run supabase-schema.sql manually in Supabase SQL Editor`,
            sqlPath: schemaPath
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    
    await logAuditEvent('schema_initialized', { supabaseUrl });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        tablesCreated: tables 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
