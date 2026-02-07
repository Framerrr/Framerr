/**
 * Monitor Integration Routes
 *
 * Note: Monitor is a Framerr-native integration that doesn't require
 * external connection testing. The "test" is handled by the monitor
 * check logic itself.
 */

import proxyRouter from './proxy';

// Export proxy router for mounting at /api/integrations/monitor/:id
export { proxyRouter };

// No external test needed for monitor integration
// Monitors are created and tested within Framerr
