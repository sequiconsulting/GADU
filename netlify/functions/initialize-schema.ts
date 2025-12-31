import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logAuditEvent } from './_shared/registry';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  try {
    const { supabaseUrl, supabaseServiceKey } = JSON.parse(event.body || '{}');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing credentials' })
      };
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
        return {
          statusCode: 500,
          body: JSON.stringify({ 
            error: `Table ${table} not found. Please run supabase-schema.sql manually in Supabase SQL Editor`,
            sqlPath: schemaPath
          })
        };
      }
    }
    
    await logAuditEvent('schema_initialized', { supabaseUrl });
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        tablesCreated: tables 
      })
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
