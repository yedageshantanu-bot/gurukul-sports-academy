import fs from 'fs';
import path from 'path';
import {
  initAuthCreds,
  BufferJSON,
  proto,
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { supabaseAdmin } from '../../config/supabase.js';

export interface DatabaseAuthStateOptions {
  sessionId: string;
  fallbackDir?: string;
  logger?: any;
  debounceMs?: number;
}

export interface DatabaseAuthStateResult {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearAuthState: () => Promise<void>;
  flushPendingWrites: () => Promise<void>;
}

/**
 * Sanitize key identifier for filesystem path safety (replaces / with __ and : with -)
 */
export function fixFileName(file: string): string {
  return file?.replace(/\//g, '__')?.replace(/:/g, '-');
}

/**
 * Senior Baileys Protocol Engineer - Database Auth State Adapter
 * 
 * Provides:
 * 1. Supabase Postgres persistence for credentials and Signal protocol keys.
 * 2. Guaranteed Buffer serialization via BufferJSON.replacer and BufferJSON.reviver.
 * 3. Transparent fallback to whatsapp_settings.session_metadata if whatsapp_auth_state table is pending migration.
 * 4. In-memory hot cache + sequential debounced batch upserts to eliminate DB pool exhaustion and race conditions.
 * 5. Ghost-read prevention for keys pending deletion.
 * 6. Single-query batch read in fallback mode (eliminates N+1 query storms).
 * 7. Path sanitization for local disk fallback.
 * 8. Clean 401 loggedOut database cleanup without accidental deletion during 515/428 reconnects or SIGTERM.
 */
export async function useDatabaseAuthState(
  options: DatabaseAuthStateOptions
): Promise<DatabaseAuthStateResult> {
  const {
    sessionId,
    fallbackDir = path.resolve('./whatsapp-sessions'),
    logger = console,
    debounceMs = 250,
  } = options;

  let tableAvailable: boolean | null = null; // null = unverified, true = exists, false = use metadata fallback
  const cache = new Map<string, any>();
  const pendingUpserts = new Map<string, string>(); // key_id -> serialized JSON
  const pendingDeletes = new Set<string>(); // key_id
  let debounceTimer: NodeJS.Timeout | null = null;
  let writeQueue: Promise<void> = Promise.resolve();

  // Helper: check if whatsapp_auth_state table exists in Supabase
  const checkTableExists = async (): Promise<boolean> => {
    if (tableAvailable !== null) return tableAvailable;
    try {
      const { error } = await supabaseAdmin
        .from('whatsapp_auth_state')
        .select('key_id')
        .limit(1);

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.code === '42P01') {
          logger.info?.('[Baileys DB Auth] whatsapp_auth_state table not yet migrated. Using whatsapp_settings fallback.');
          tableAvailable = false;
          return false;
        }
      }
      tableAvailable = true;
      return true;
    } catch {
      tableAvailable = false;
      return false;
    }
  };

  // 1. Raw Read from DB (or fallback)
  const readData = async (keyId: string): Promise<any> => {
    // If pending deletion, it does not exist
    if (pendingDeletes.has(keyId)) {
      return null;
    }

    // Check in-memory cache first
    if (cache.has(keyId)) {
      return cache.get(keyId);
    }

    const hasTable = await checkTableExists();

    if (hasTable) {
      try {
        const { data, error } = await supabaseAdmin
          .from('whatsapp_auth_state')
          .select('value')
          .eq('session_id', sessionId)
          .eq('key_id', keyId)
          .maybeSingle();

        if (!error && data?.value) {
          const parsed = JSON.parse(data.value, BufferJSON.reviver);
          cache.set(keyId, parsed);
          return parsed;
        }
      } catch (err: any) {
        logger.warn?.(`[Baileys DB Auth] Error reading ${keyId} from DB:`, err.message);
      }
    } else {
      // Fallback: Read from whatsapp_settings.session_metadata.baileys_auth
      try {
        const { data, error } = await supabaseAdmin
          .from('whatsapp_settings')
          .select('session_metadata')
          .limit(1)
          .maybeSingle();

        const authStore = data?.session_metadata?.baileys_auth || {};
        const raw = authStore[keyId];
        if (!error && raw !== undefined && raw !== null) {
          const parsed = typeof raw === 'string'
            ? JSON.parse(raw, BufferJSON.reviver)
            : JSON.parse(JSON.stringify(raw), BufferJSON.reviver);
          cache.set(keyId, parsed);
          return parsed;
        }
      } catch (err: any) {
        logger.warn?.(`[Baileys DB Auth] Metadata read fallback notice:`, err.message);
      }
    }

    // Third-tier local disk fallback (e.g. during local dev or offline migration)
    try {
      const safeKey = fixFileName(keyId);
      const diskPath = path.join(fallbackDir, `${safeKey}.json`);
      if (fs.existsSync(diskPath)) {
        const content = fs.readFileSync(diskPath, 'utf-8');
        const parsed = JSON.parse(content, BufferJSON.reviver);
        cache.set(keyId, parsed);
        return parsed;
      }
    } catch {}

    return null;
  };

  // 2. Batch Read for Signal Keys
  const readKeysBatch = async (type: string, ids: string[]): Promise<Record<string, any>> => {
    const result: Record<string, any> = {};
    const missingIds: string[] = [];

    for (const id of ids) {
      const keyId = `${type}-${id}`;
      if (pendingDeletes.has(keyId)) {
        result[id] = null;
      } else if (cache.has(keyId)) {
        result[id] = cache.get(keyId);
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length === 0) {
      return result;
    }

    const hasTable = await checkTableExists();
    if (hasTable) {
      try {
        const keyIdsToFetch = missingIds.map((id) => `${type}-${id}`);
        const { data, error } = await supabaseAdmin
          .from('whatsapp_auth_state')
          .select('key_id, value')
          .eq('session_id', sessionId)
          .in('key_id', keyIdsToFetch);

        if (!error && Array.isArray(data)) {
          const returnedMap = new Map<string, string>();
          for (const row of data) {
            returnedMap.set(row.key_id, row.value);
          }

          for (const id of missingIds) {
            const keyId = `${type}-${id}`;
            const rawVal = returnedMap.get(keyId);
            if (rawVal) {
              try {
                let parsed = JSON.parse(rawVal, BufferJSON.reviver);
                if (type === 'app-state-sync-key' && parsed) {
                  parsed = proto.Message.AppStateSyncKeyData.fromObject(parsed);
                }
                cache.set(keyId, parsed);
                result[id] = parsed;
              } catch {
                result[id] = null;
              }
            } else {
              result[id] = null;
            }
          }
          return result;
        }
      } catch (err: any) {
        logger.warn?.(`[Baileys DB Auth] Batch keys read error:`, err.message);
      }
    } else {
      // Fallback: Batch read from whatsapp_settings in a SINGLE query
      try {
        const { data, error } = await supabaseAdmin
          .from('whatsapp_settings')
          .select('session_metadata')
          .limit(1)
          .maybeSingle();

        if (!error && data?.session_metadata) {
          const authStore = data.session_metadata.baileys_auth || {};
          for (const id of missingIds) {
            const keyId = `${type}-${id}`;
            const raw = authStore[keyId];
            if (raw !== undefined && raw !== null) {
              try {
                let parsed = typeof raw === 'string'
                  ? JSON.parse(raw, BufferJSON.reviver)
                  : JSON.parse(JSON.stringify(raw), BufferJSON.reviver);
                if (type === 'app-state-sync-key' && parsed) {
                  parsed = proto.Message.AppStateSyncKeyData.fromObject(parsed);
                }
                cache.set(keyId, parsed);
                result[id] = parsed;
              } catch {
                result[id] = null;
              }
            } else {
              result[id] = null;
            }
          }
          return result;
        }
      } catch (err: any) {
        logger.warn?.(`[Baileys DB Auth] Batch keys fallback read error:`, err.message);
      }
    }

    // Disk fallback if DB was unreachable
    for (const id of missingIds) {
      if (result[id] === undefined || result[id] === null) {
        try {
          const safeKey = fixFileName(`${type}-${id}`);
          const diskPath = path.join(fallbackDir, `${safeKey}.json`);
          if (fs.existsSync(diskPath)) {
            const content = fs.readFileSync(diskPath, 'utf-8');
            let parsed = JSON.parse(content, BufferJSON.reviver);
            if (type === 'app-state-sync-key' && parsed) {
              parsed = proto.Message.AppStateSyncKeyData.fromObject(parsed);
            }
            cache.set(`${type}-${id}`, parsed);
            result[id] = parsed;
          } else {
            result[id] = null;
          }
        } catch {
          result[id] = null;
        }
      }
    }

    return result;
  };

  // 3. Sequential Batch Flush to Database (Promise Queue)
  const flushPendingWrites = async (): Promise<void> => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    // Chain execution sequentially so concurrent flush requests never drop updates
    const currentTask = writeQueue.then(async () => {
      if (pendingUpserts.size === 0 && pendingDeletes.size === 0) {
        return;
      }

      // Snapshot pending entries
      const upsertsToCommit = Array.from(pendingUpserts.entries());
      const deletesToCommit = Array.from(pendingDeletes.values());

      // Clear pending maps so new incoming items during the async call are collected for the next flush
      pendingUpserts.clear();
      pendingDeletes.clear();

      const hasTable = await checkTableExists();

      if (hasTable) {
        try {
          // 1. Execute Upserts
          if (upsertsToCommit.length > 0) {
            const rows = upsertsToCommit.map(([key_id, value]) => ({
              session_id: sessionId,
              key_id,
              value,
              updated_at: new Date().toISOString(),
            }));

            const CHUNK_SIZE = 50;
            for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
              const chunk = rows.slice(i, i + CHUNK_SIZE);
              const { error } = await supabaseAdmin
                .from('whatsapp_auth_state')
                .upsert(chunk, { onConflict: 'session_id,key_id' });

              if (error) {
                logger.warn?.('[Baileys DB Auth] Error upserting keys batch:', error.message);
                // Re-queue failed items if not superseded
                for (const row of chunk) {
                  if (!pendingUpserts.has(row.key_id)) {
                    pendingUpserts.set(row.key_id, row.value);
                  }
                }
              }
            }
          }

          // 2. Execute Deletes
          if (deletesToCommit.length > 0) {
            const CHUNK_SIZE = 50;
            for (let i = 0; i < deletesToCommit.length; i += CHUNK_SIZE) {
              const chunk = deletesToCommit.slice(i, i + CHUNK_SIZE);
              const { error } = await supabaseAdmin
                .from('whatsapp_auth_state')
                .delete()
                .eq('session_id', sessionId)
                .in('key_id', chunk);

              if (error) {
                logger.warn?.('[Baileys DB Auth] Error deleting keys batch:', error.message);
              }
            }
          }
        } catch (err: any) {
          logger.error?.('[Baileys DB Auth] Flush error to whatsapp_auth_state:', err.message);
          // Re-queue upserts
          for (const [k, v] of upsertsToCommit) {
            if (!pendingUpserts.has(k)) pendingUpserts.set(k, v);
          }
        }
      } else {
        // Fallback: Commit to whatsapp_settings.session_metadata.baileys_auth
        try {
          const { data } = await supabaseAdmin
            .from('whatsapp_settings')
            .select('id, session_metadata')
            .limit(1)
            .maybeSingle();

          if (data?.id) {
            const currentMeta = data.session_metadata || {};
            const baileysAuth = { ...(currentMeta.baileys_auth || {}) };

            for (const [k, v] of upsertsToCommit) {
              baileysAuth[k] = v;
            }
            for (const k of deletesToCommit) {
              delete baileysAuth[k];
            }

            await supabaseAdmin
              .from('whatsapp_settings')
              .update({
                session_metadata: {
                  ...currentMeta,
                  baileys_auth: baileysAuth,
                },
                updated_at: new Date().toISOString(),
              })
              .eq('id', data.id);
          }
        } catch (err: any) {
          logger.warn?.('[Baileys DB Auth] Fallback metadata commit notice:', err.message);
          for (const [k, v] of upsertsToCommit) {
            if (!pendingUpserts.has(k)) pendingUpserts.set(k, v);
          }
        }
      }

      // Also mirror to local disk as a resilience buffer
      try {
        if (!fs.existsSync(fallbackDir)) {
          fs.mkdirSync(fallbackDir, { recursive: true });
        }
        for (const [key_id, value] of upsertsToCommit) {
          const safeKey = fixFileName(key_id);
          const diskPath = path.join(fallbackDir, `${safeKey}.json`);
          fs.writeFileSync(diskPath, value, 'utf-8');
        }
        for (const key_id of deletesToCommit) {
          const safeKey = fixFileName(key_id);
          const diskPath = path.join(fallbackDir, `${safeKey}.json`);
          if (fs.existsSync(diskPath)) {
            try { fs.unlinkSync(diskPath); } catch {}
          }
        }
      } catch {}
    });

    writeQueue = currentTask.catch((err) => {
      logger.error?.('[Baileys DB Auth] Write queue task error:', err.message);
    });

    return currentTask;
  };

  const scheduleFlush = () => {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      flushPendingWrites().catch((err) => {
        logger.error?.('[Baileys DB Auth] Debounced flush error:', err.message);
      });
    }, debounceMs);
    if (debounceTimer.unref) debounceTimer.unref();
  };

  // 4. Initial Creds Load
  const rawCreds = await readData('creds');
  const creds: AuthenticationCreds = rawCreds || initAuthCreds();

  // Return AuthenticationState structure
  return {
    state: {
      creds,
      keys: {
        get: async (type: keyof SignalDataTypeMap, ids: string[]) => {
          return await readKeysBatch(type, ids);
        },
        set: async (data: any) => {
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const keyId = `${category}-${id}`;

              if (value) {
                cache.set(keyId, value);
                const serialized = JSON.stringify(value, BufferJSON.replacer);
                pendingUpserts.set(keyId, serialized);
                pendingDeletes.delete(keyId);
              } else {
                cache.delete(keyId);
                pendingDeletes.add(keyId);
                pendingUpserts.delete(keyId);
              }
            }
          }
          scheduleFlush();
        },
      },
    },

    saveCreds: async () => {
      cache.set('creds', creds);
      const serialized = JSON.stringify(creds, BufferJSON.replacer);
      pendingUpserts.set('creds', serialized);
      pendingDeletes.delete('creds');
      // Save creds immediately with guaranteed sequential persistence
      await flushPendingWrites();
    },

    clearAuthState: async () => {
      logger.info?.(`[Baileys DB Auth] Purging auth state for session: ${sessionId}`);
      cache.clear();
      pendingUpserts.clear();
      pendingDeletes.clear();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      const hasTable = await checkTableExists();
      if (hasTable) {
        try {
          await supabaseAdmin
            .from('whatsapp_auth_state')
            .delete()
            .eq('session_id', sessionId);
        } catch (err: any) {
          logger.warn?.('[Baileys DB Auth] Clear table error:', err.message);
        }
      }

      // Clear from whatsapp_settings session_metadata
      try {
        const { data } = await supabaseAdmin
          .from('whatsapp_settings')
          .select('id, session_metadata')
          .limit(1)
          .maybeSingle();

        if (data?.id && data.session_metadata?.baileys_auth) {
          const currentMeta = { ...data.session_metadata };
          delete currentMeta.baileys_auth;
          await supabaseAdmin
            .from('whatsapp_settings')
            .update({
              session_metadata: currentMeta,
              updated_at: new Date().toISOString(),
            })
            .eq('id', data.id);
        }
      } catch {}

      // Clear local disk directory
      try {
        if (fs.existsSync(fallbackDir)) {
          fs.rmSync(fallbackDir, { recursive: true, force: true });
        }
      } catch {}
    },

    flushPendingWrites,
  };
}
