/**
 * Tab data structure from API
 */
export interface Tab {
    slug: string;
    name: string;
    url: string;
    enabled?: boolean;
    openInNewTab?: boolean;
}

/**
 * API response wrapper for tabs endpoint
 */
export interface TabsApiResponse {
    tabs: Tab[];
}
