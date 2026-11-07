import app from './app.js';
import { env } from './config/env.js';
import { queueService } from './services/whatsapp/queue.service.js';
import { feeService } from './services/fee.service.js';

const PORT = env.PORT || 10000;
const HOST = env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Academy CRM Backend listening on http://${HOST}:${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);

  // Automatically start continuous WhatsApp queue & schedule runner
  queueService.startQueueScheduler(5000);

  // Auto-sync monthly fees and backfill missing dues on startup
  feeService.syncMonthlyFeesForAllStudents().then((res) => {
    console.log(`[FeeService] Monthly fees auto-synced on startup: ${res.createdCount} new bills generated.`);
  }).catch((err) => {
    console.warn('[FeeService] Auto-sync fee notice:', err.message);
  });
});
