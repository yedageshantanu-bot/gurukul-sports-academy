import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { ROLES } from '../constants/index.js';
import { AuthenticatedUser } from '../types/auth.types.js';
import { requestContext } from './requestContext.js';

let _rawAdminClient: SupabaseClient<any, any, any> | null = null;
let supabaseDemoClient: SupabaseClient<any, any, any> | null = null;
let supabasePublicClient: SupabaseClient<any, any, any> | null = null;

if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  // Public (Production Owner) client
  supabasePublicClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });

  // Demo (Effort Career Classes Isolated) client
  supabaseDemoClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'demo' },
  });

  const isDemoEnv = env.DEMO_MODE || env.APP_ENV === 'demo';
  _rawAdminClient = isDemoEnv ? supabaseDemoClient : supabasePublicClient;

  console.log(`[Supabase] Initialized clients. Default active schema: [${isDemoEnv ? 'demo' : 'public'}]`);
} else {
  console.warn('⚠️ Supabase URL or Service Role Key missing. Database operations will require credentials.');
}

/**
 * Returns schema-isolated Supabase client based on authenticated user role/trial status or active request context
 */
export function getDb(user?: AuthenticatedUser): SupabaseClient<any, any, any> {
  const currentUser = user || requestContext.getStore()?.user;
  const isDemo = env.DEMO_MODE || env.APP_ENV === 'demo' || currentUser?.role === ROLES.DEMO_ADMIN || currentUser?.isTrial;
  if (isDemo && supabaseDemoClient) {
    return supabaseDemoClient;
  }
  return supabasePublicClient || _rawAdminClient!;
}

/**
 * Proxy supabaseAdmin that dynamically routes queries to the correct schema
 * according to the requesting user's identity (DEMO_ADMIN -> demo.*, OWNER/ADMIN -> public.*).
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient<any, any, any>, {
  get(_target, prop, receiver) {
    const activeClient = getDb();
    if (!activeClient) {
      return undefined;
    }
    if (prop === 'from') {
      return (relation: string) => {
        const globalPublicTables = [
          'whatsapp_templates',
          'whatsapp_messages',
          'whatsapp_queue',
          'whatsapp_settings',
          'whatsapp_logs',
        ];
        if (globalPublicTables.includes(relation) && supabasePublicClient) {
          return supabasePublicClient.from(relation);
        }
        return activeClient.from(relation);
      };
    }
    const value = Reflect.get(activeClient, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(activeClient);
    }
    return value;
  },
});

export function getPublicClient(): SupabaseClient<any, any, any> {
  return supabasePublicClient!;
}

export function getDemoClient(): SupabaseClient<any, any, any> {
  return supabaseDemoClient!;
}

export { supabaseDemoClient, supabasePublicClient };
