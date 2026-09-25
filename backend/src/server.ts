import app from './app.js';
import { env } from './config/env.js';

const PORT = env.PORT || 10000;
const HOST = env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Academy CRM Backend listening on http://${HOST}:${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});
