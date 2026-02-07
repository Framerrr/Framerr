/**
 * Tab data structure from API
 */
export interface Tab {
    slug: string;
    name: string;
    url: string;
}

/**
 * API response wrapper for tabs endpoint
 */
export interface TabsApiResponse {
    tabs: Tab[];
}
