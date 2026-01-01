import { createClient, SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';

// Global cache to avoid multiple GoTrueClient instances under the same storage key
const GLOBAL_CACHE_KEY = '__gadu_supabase_clients__';

type ClientCache = Map<string, SupabaseClient>;

type CacheHost = typeof globalThis & {
  [GLOBAL_CACHE_KEY]?: ClientCache;
};

const getCache = (): ClientCache => {
  const host = globalThis as CacheHost;
  if (!host[GLOBAL_CACHE_KEY]) {
    host[GLOBAL_CACHE_KEY] = new Map<string, SupabaseClient>();
  }
  return host[GLOBAL_CACHE_KEY]!;
};

export const getCachedSupabaseClient = (
  url: string,
  key: string,
  options?: SupabaseClientOptions<'public'>
): SupabaseClient => {
  const cache = getCache();
  const cacheKey = `${url}:${key}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      ...(options?.auth || {}),
    },
    ...options,
  });

  cache.set(cacheKey, client);
  return client;
};
