/**
 * Widget Fetch Utilities
 * 
 * Helper functions for making API calls from widgets.
 * Automatically includes the X-Widget-Type header for authorization.
 */

/**
 * Create headers object with X-Widget-Type for authorization
 * 
 * @param widgetType - The widget type (e.g., 'plex-sessions', 'sonarr', etc.)
 * @param additionalHeaders - Additional headers to include
 */
export function getWidgetHeaders(
    widgetType: string,
    additionalHeaders: Record<string, string> = {}
): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'X-Widget-Type': widgetType,
        'X-Framerr-Client': '1',  // Required for CSRF protection on POST/PUT/DELETE
        ...additionalHeaders
    };
}

/**
 * Fetch wrapper that includes X-Widget-Type header
 * 
 * @param url - The URL to fetch
 * @param widgetType - The widget type for authorization
 * @param options - Additional fetch options
 */
export async function widgetFetch(
    url: string,
    widgetType: string,
    options: RequestInit = {}
): Promise<Response> {
    const headers = {
        ...getWidgetHeaders(widgetType),
        ...(options.headers as Record<string, string> || {})
    };

    return fetch(url, {
        ...options,
        headers,
        // Include credentials (session cookie) for authentication
        credentials: 'include'
    });
}

/**
 * Widget JSON fetch - convenience method that parses response as JSON
 * 
 * @param url - The URL to fetch
 * @param widgetType - The widget type for authorization
 * @param options - Additional fetch options
 */
export async function widgetFetchJson<T = unknown>(
    url: string,
    widgetType: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await widgetFetch(url, widgetType, options);

    if (!response.ok) {
        throw new Error(`Widget fetch failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
}
