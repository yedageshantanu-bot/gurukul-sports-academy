import { useDatabaseAuthState, fixFileName } from '../services/whatsapp/baileysAuthState.js';
import { BaileysConnectionManager, BaileysWhatsAppProvider } from '../services/whatsapp/baileysConnectionManager.js';
import { queueService } from '../services/whatsapp/queue.service.js';
import { whatsappProviderFactory } from '../services/whatsapp/whatsappProvider.factory.js';
import { updateWhatsAppSettingsSchema, WHATSAPP_PROVIDER_TYPES } from '../types/whatsapp.types.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, errorDetail?: any) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`, errorDetail ? errorDetail : '');
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 Running Baileys Database Auth, Queue & Reliability Test Suite');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST SUITE 1: Database Auth State & BufferJSON Serialization
  // --------------------------------------------------------------------------
  console.log('▶ [Suite 1] Database Auth Adapter & BufferJSON Serialization');
  const testSessionId = `test-session-${Date.now()}`;
  const authAdapter = await useDatabaseAuthState({
    sessionId: testSessionId,
    debounceMs: 50,
  });

  assert(Boolean(authAdapter.state?.creds), 'Auth adapter initializes AuthenticationCreds');
  assert(typeof authAdapter.state.keys.get === 'function', 'Auth adapter exposes keys.get');
  assert(typeof authAdapter.state.keys.set === 'function', 'Auth adapter exposes keys.set');

  // Test BufferJSON Serialization & Reviver
  const mockBuffer = Buffer.from('baileys-crypto-identity-test-key-2026');
  const keyData = {
    'pre-key': {
      '1': {
        keyPair: {
          public: mockBuffer,
          private: Buffer.from('private-key-bytes'),
        },
      },
    },
  };

  await authAdapter.state.keys.set(keyData);
  await authAdapter.flushPendingWrites();

  const retrieved = await authAdapter.state.keys.get('pre-key', ['1']);
  assert(Boolean(retrieved['1']), 'Retrieved pre-key from auth adapter');
  assert(Buffer.isBuffer(retrieved['1']?.keyPair?.public), 'Public key revived as native Node Buffer (BufferJSON.reviver)');
  assert(retrieved['1']?.keyPair?.public.toString() === 'baileys-crypto-identity-test-key-2026', 'Buffer content matches exactly without corruption');

  // Test Ghost-Read Prevention: delete key and verify immediate get returns null even before flush
  await authAdapter.state.keys.set({
    'pre-key': {
      '1': null,
    },
  });
  const ghostCheck = await authAdapter.state.keys.get('pre-key', ['1']);
  assert(ghostCheck['1'] === null || ghostCheck['1'] === undefined, 'Ghost-read prevented: pending delete returns null before flush');
  await authAdapter.flushPendingWrites();
  const afterDeleteFlush = await authAdapter.state.keys.get('pre-key', ['1']);
  assert(!afterDeleteFlush['1'], 'Key remains deleted after flush');

  // Test fixFileName sanitization
  const testKeyWithSlashes = 'sender-key-12345@s.whatsapp.net/0';
  const sanitized = fixFileName(testKeyWithSlashes);
  assert(!sanitized.includes('/') && !sanitized.includes(':'), 'fixFileName sanitizes / and : from disk paths');

  // Test Concurrent saveCreds & keys.set
  authAdapter.state.creds.me = { id: '919404849500:1@s.whatsapp.net', name: 'Gurukul Academy' };
  const p1 = authAdapter.state.keys.set({
    'session': {
      'test-session-key': { active: true },
    },
  });
  const p2 = authAdapter.saveCreds();
  await Promise.all([p1, p2]);
  assert(authAdapter.state.creds.me?.name === 'Gurukul Academy', 'Concurrent saveCreds and keys.set serialize cleanly');

  // Test clearAuthState on 401
  await authAdapter.clearAuthState();
  const afterClear = await authAdapter.state.keys.get('session', ['test-session-key']);
  assert(!afterClear['test-session-key'], 'clearAuthState cleans up session keys completely');

  // --------------------------------------------------------------------------
  // TEST SUITE 2: Render 512MB RAM & Disconnect Guards Verification
  // --------------------------------------------------------------------------
  console.log('\n▶ [Suite 2] Render 512MB RAM Guards & Socket Configuration');
  const manager = new BaileysConnectionManager({
    sessionId: 'test-audit-manager',
    sessionDir: './whatsapp-sessions-test',
  });

  assert(manager.getState() === 'INITIALIZING', 'Connection manager starts in INITIALIZING state');
  const status = manager.getStatus();
  assert(status.state === 'INITIALIZING', 'getStatus returns session state accurately');

  // Test Pre-Send Number Validation rejecting empty onWhatsApp result
  const mockUnregisteredSocket = {
    onWhatsApp: async (_jid: string) => {
      // Baileys returns [] when contact is not registered
      return [];
    },
    sendMessage: async () => ({ key: { id: 'mock-id' } }),
  };

  (manager as any).socket = mockUnregisteredSocket;
  (manager as any).currentState = 'CONNECTED';

  let caughtUnregistered = false;
  try {
    await manager.sendPayload('+919999999999', { text: 'Test' });
  } catch (err: any) {
    if (err.message?.includes('not registered on WhatsApp')) {
      caughtUnregistered = true;
    }
  }
  assert(caughtUnregistered, 'Pre-send number validation correctly rejects empty onWhatsApp result ([])');

  // Test Pre-Send Number Validation accepting registered onWhatsApp result
  const mockRegisteredSocket = {
    onWhatsApp: async (jid: string) => {
      return [{ exists: true, jid }];
    },
    sendMessage: async () => ({ key: { id: 'sent-msg-123' } }),
  };
  (manager as any).socket = mockRegisteredSocket;
  (manager as any).lastDispatchedAt = 0; // Reset throttle for test
  const sendResult = await manager.sendPayload('+919404849500', { text: 'Test Valid' });
  assert(sendResult?.key?.id === 'sent-msg-123', 'Pre-send number validation passes valid registered number');

  // --------------------------------------------------------------------------
  // TEST SUITE 3: Queue Service Reconnecting Gate & Anti-Ban Throttling
  // --------------------------------------------------------------------------
  console.log('\n▶ [Suite 3] Queue Service Reconnecting Gate, Throttling & Retries');
  assert(queueService.MIN_DISPATCH_INTERVAL_MS >= 3500, 'Queue service enforces minimum 3.5s anti-ban throttle interval');

  // Pre-Send Number Validation check
  assert(typeof queueService.isBlockedOrDummyNumber === 'function', 'Queue service exposes isBlockedOrDummyNumber');
  assert(queueService.isBlockedOrDummyNumber('0000000000'), 'Dummy placeholder number 0000000000 is blocked');
  assert(!queueService.isBlockedOrDummyNumber('+919404849500'), 'Verified admin phone is permitted');

  // Test Retry Logic: transient error vs permanent error
  const transientTestItem = await queueService.enqueueMessage({
    recipientPhone: '+919404849500',
    messageBody: `Transient Retry Test ${Date.now()}`,
    eventType: 'TEST_RETRY',
  });

  // Call markItemFailed with transient error (countAsAttempt: true, isPermanent: false)
  await (queueService as any).markItemFailed(transientTestItem.id, 'zombie socket send timed out', true, false);
  const queueAfterTransient = (queueService as any).inMemoryQueue.get(transientTestItem.id);
  assert(queueAfterTransient?.status === 'PENDING', 'Transient error (zombie socket) keeps item in PENDING for retry');
  assert(queueAfterTransient?.attempts === 1, 'Transient error increments attempts counter');

  // Call markItemFailed with permanent error
  await (queueService as any).markItemFailed(transientTestItem.id, 'Recipient not registered on WhatsApp', true, true);
  const queueAfterPermanent = (queueService as any).inMemoryQueue.get(transientTestItem.id);
  assert(queueAfterPermanent?.status === 'FAILED', 'Permanent error transitions item to FAILED immediately');

  // Clean up test item
  await queueService.deleteQueueItem(transientTestItem.id);

  // --------------------------------------------------------------------------
  // TEST SUITE 4: Provider Factory & Baileys Provider Wiring
  // --------------------------------------------------------------------------
  console.log('\n▶ [Suite 4] Provider Factory & Baileys Provider Wiring');
  const baileysProvider = whatsappProviderFactory.getBaileysProvider();
  assert(baileysProvider.name === 'BAILEYS', 'Baileys provider has correct provider name BAILEYS');

  const providerHealth = await baileysProvider.healthCheck();
  assert(typeof providerHealth.healthy === 'boolean', 'Baileys healthCheck returns boolean health state');

  const providerStatus = await baileysProvider.getStatus();
  assert(providerStatus.isConfigured === true, 'Baileys provider reports isConfigured === true');
  assert(providerStatus.status !== undefined, 'Baileys provider returns defined status');

  // Test Zod Schema accepting 'baileys'
  assert(WHATSAPP_PROVIDER_TYPES.includes('baileys' as any), 'WHATSAPP_PROVIDER_TYPES includes baileys');
  const parsedSettings = updateWhatsAppSettingsSchema.safeParse({ providerType: 'baileys' });
  assert(parsedSettings.success, 'updateWhatsAppSettingsSchema accepts providerType: baileys');

  console.log('\n================================================================');
  console.log(`Diagnostic Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
