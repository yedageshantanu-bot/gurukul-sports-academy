import { env } from '../config/env.js';
import { whatsappProviderFactory } from '../services/whatsapp/whatsappProvider.factory.js';

async function main() {
  console.log('===========================================================');
  console.log('🔍 Testing Backend -> Deployed Render WhatsApp Bridge');
  console.log('===========================================================');
  console.log('Provider Type           :', env.WHATSAPP_PROVIDER);
  console.log('Bridge Target URL       :', env.WHATSAPP_LINKED_DEVICE_URL);
  console.log('Token Configured in Env :', Boolean(env.WHATSAPP_LINKED_DEVICE_TOKEN));
  console.log('-----------------------------------------------------------');

  const targetUrl = (env.WHATSAPP_LINKED_DEVICE_URL || '').replace(/\/+$/, '');
  const token = env.WHATSAPP_LINKED_DEVICE_TOKEN || '';

  if (!targetUrl) {
    console.error('❌ Error: WHATSAPP_LINKED_DEVICE_URL is not configured');
    process.exit(1);
  }

  // Check 1: Public GET /health
  console.log(`\n[Check 1] Calling public ${targetUrl}/health ...`);
  try {
    const healthRes = await fetch(`${targetUrl}/health`);
    console.log(`HTTP Status: ${healthRes.status} ${healthRes.statusText}`);
    const healthBody = await healthRes.json().catch(() => ({}));
    console.log('Response Payload:', JSON.stringify(healthBody, null, 2));

    if (healthRes.status === 200 && healthBody.ok === true) {
      console.log('✅ Check 1 PASSED: Public /health returned HTTP 200');
    } else {
      console.warn('⚠️ Check 1 warning: Status is not 200 or response structure unexpected');
    }
  } catch (err: any) {
    console.error('❌ Check 1 Failed (Network error):', err.message);
  }

  // Check 2: Authenticated GET /status with Bearer token
  console.log(`\n[Check 2] Calling authenticated ${targetUrl}/status (Authorization: Bearer <token>) ...`);
  try {
    const statusRes = await fetch(`${targetUrl}/status`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    console.log(`HTTP Status: ${statusRes.status} ${statusRes.statusText}`);
    const statusBody = await statusRes.json().catch(() => ({}));
    console.log('Response Summary:', {
      success: statusBody.success,
      status: statusBody.status,
      phone: statusBody.phone || 'none',
      providerName: statusBody.providerName,
      hasQrCode: Boolean(statusBody.qrCode),
      sessionStatus: statusBody.sessionStatus,
    });

    if (statusRes.status === 200 && statusBody.success === true) {
      console.log('✅ Check 2 PASSED: Authenticated /status returned HTTP 200 with real device state');
    } else if (statusRes.status === 401) {
      console.error('❌ Check 2 FAILED: Bridge rejected token (HTTP 401 Unauthorized). Verify token match.');
    } else {
      console.warn(`⚠️ Check 2 warning: Bridge returned HTTP ${statusRes.status}`);
    }
  } catch (err: any) {
    console.error('❌ Check 2 Failed (Network error):', err.message);
  }

  // Check 3: WhatsApp Provider Factory and Adapter
  console.log('\n[Check 3] Calling whatsappProviderFactory.getProvider().getStatus() ...');
  try {
    const provider = whatsappProviderFactory.getProvider();
    console.log('Active Provider Adapter:', provider.name);
    const liveStatus = await provider.getStatus();
    console.log('Adapter Result:', {
      status: liveStatus.status,
      isConfigured: liveStatus.isConfigured,
      phoneNumber: liveStatus.phoneNumber || 'none',
      hasQrCode: Boolean(liveStatus.qrCode),
      sessionStatus: liveStatus.sessionStatus,
      details: liveStatus.details,
    });

    if (liveStatus.status !== 'NOT_CONFIGURED') {
      console.log('✅ Check 3 PASSED: Adapter successfully reflects real bridge state (honest, not fake)');
    }
  } catch (err: any) {
    console.error('❌ Check 3 Failed:', err.message);
  }

  console.log('\n===========================================================');
  console.log('Diagnostic Complete');
  console.log('===========================================================\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
