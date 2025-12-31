import { Handler } from '@netlify/functions';
import { loadRegistry } from './_shared/registry';
import { PublicLodgeConfig } from '../../types/lodge';

export const handler: Handler = async (event) => {
  const glriNumber = event.queryStringParameters?.glriNumber || event.queryStringParameters?.number;
  
  if (!glriNumber) {
    return { statusCode: 400, body: 'Missing glriNumber parameter' };
  }
  
  try {
    const registry = await loadRegistry();
    const lodge = registry[glriNumber];
    
    if (!lodge) {
      return { statusCode: 404, body: 'Lodge not found' };
    }
    
    // Remove service key before sending to client
    const publicConfig: PublicLodgeConfig = {
      glriNumber: lodge.glriNumber,
      lodgeName: lodge.lodgeName,
      province: lodge.province,
      supabaseUrl: lodge.supabaseUrl,
      supabaseAnonKey: lodge.supabaseAnonKey
    };
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publicConfig)
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
