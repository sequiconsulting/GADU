import { Handler } from '@netlify/functions';
import { loadRegistry } from './shared/registry';
import { PublicLodgeConfig } from '../../types/lodge';

export const handler: Handler = async (event) => {
  try {
    const glriNumber =
      event.queryStringParameters?.glriNumber || event.queryStringParameters?.number;

    if (!glriNumber) {
      return {
        statusCode: 400,
        body: 'Missing glriNumber parameter'
      };
    }

    const registry = await loadRegistry();
    console.log(`[GET-LODGE-CONFIG] Looking for lodge ${glriNumber}`);
    console.log(`[GET-LODGE-CONFIG] Registry keys: ${Object.keys(registry).join(', ')}`);
    const lodge = registry[glriNumber];

    if (!lodge) {
      return {
        statusCode: 404,
        body: 'Lodge not found'
      };
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
    console.error('[GET-LODGE-CONFIG] Error', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Unknown error' })
    };
  }
};
