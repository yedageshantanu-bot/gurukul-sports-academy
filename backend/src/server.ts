import app from './app.js';
import { env } from './config/env.js';
import { queueService } from './services/whatsapp/queue.service.js';
import { feeService } from './services/fee.service.js';
import { announcementService } from './services/announcement.service.js';
import { whatsappProviderFactory } from './services/whatsapp/whatsappProvider.factory.js';

const PORT = env.PORT || 10000;
const HOST = env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Academy CRM Backend listening on http://${HOST}:${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);

  // Automatically start continuous WhatsApp queue & schedule runner
  queueService.startQueueScheduler(5000);

  // Startup recovery: recover any interrupted SENDING announcements back to SCHEDULED
  announcementService.recoverInterruptedSendingAnnouncements().catch((err) => {
    console.warn('[AnnouncementService] Startup recovery notice:', err.message);
  });

  // Auto-sync monthly fees and backfill missing dues on startup
  feeService.syncMonthlyFeesForAllStudents().then((res) => {
    console.log(`[FeeService] Monthly fees auto-synced on startup: ${res.createdCount} new bills generated.`);
  }).catch((err) => {
    console.warn('[FeeService] Auto-sync fee notice:', err.message);
  });
});

// Graceful Shutdown for Render Free Tier restarts / redeploys (SIGTERM / SIGINT)
const handleGracefulShutdown = async (signal: string) => {
  console.log(`\n[Server] 🛑 Received ${signal}. Starting graceful shutdown...`);
  try {
    // 1. Stop queue scheduler & watchdog timers
    queueService.stopQueueScheduler();

    // 2. Disconnect Baileys socket cleanly WITHOUT deleting credentials
    const baileysProvider = whatsappProviderFactory.getBaileysProvider();
    if (baileysProvider) {
      await baileysProvider.disconnect().catch(() => {});
    }

    // 3. Close HTTP server
    server.close(() => {
      console.log('[Server] ✅ HTTP server closed cleanly. Process exiting.');
      process.exit(0);
    });

    // Fallback force exit after 8 seconds if hanging
    setTimeout(() => {
      console.warn('[Server] ⚠️ Graceful shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 8000).unref();
  } catch (err: any) {
    console.error('[Server] Error during graceful shutdown:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
