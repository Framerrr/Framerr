/**
 * HTTP Options for BaseAdapter requests
 * 
 * Shared type used by get(), post(), and request() methods.
 * 
 * @module server/integrations/httpTypes
 */

export interface HttpOpts {
    /** Request timeout in milliseconds (default: 15000) */
    timeout?: number;
    /** URL query parameters */
    params?: Record<string, unknown>;
    /** Response type (default: 'json') */
    responseType?: 'json' | 'arraybuffer' | 'stream';
    /** Additional headers merged with auth headers */
    headers?: Record<string, string>;
}
