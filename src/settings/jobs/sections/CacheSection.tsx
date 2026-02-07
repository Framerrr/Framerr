/**
 * CacheSection - Cache stats display with flush/sync actions
 * 
 * Expandable table showing TMDB metadata, TMDB images, library cache
 * (per-integration breakdown), and search history.
 */

import React, { useState } from 'react';
import { Database, Trash2, RefreshCw, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { SettingsSection } from '../../../shared/ui/settings';
import type { CacheStats } from '../types';

interface CacheSectionProps {
    cacheStats: CacheStats | null;
    isLoading: boolean;
    flushingCache: string | null;
    syncingIntegration: string | null;
    onFlushTmdbMetadata: () => void;
    onFlushTmdbImages: () => void;
    onClearSearchHistory: () => void;
    onFlushLibrary: (integrationId: string) => void;
    onSyncLibrary: (integrationId: string) => void;
}

/** Format bytes to human-readable size */
function formatSize(bytes: number): string {
    if (bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(1)} GB`;
}

export const CacheSection: React.FC<CacheSectionProps> = ({
    cacheStats,
    isLoading,
    flushingCache,
    syncingIntegration,
    onFlushTmdbMetadata,
    onFlushTmdbImages,
    onClearSearchHistory,
    onFlushLibrary,
    onSyncLibrary,
}) => {
    const [libraryExpanded, setLibraryExpanded] = useState(false);

    if (isLoading || !cacheStats) {
        return (
            <SettingsSection title="Cache Management" icon={Database}>
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-theme-secondary" />
                </div>
            </SettingsSection>
        );
    }

    const hasLibraryItems = cacheStats.libraryPerIntegration.length > 0;

    return (
        <SettingsSection
            title="Cache Management"
            icon={Database}
            description="View and manage cached data"
        >
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-theme-light">
                            <th className="text-left py-2 px-3 text-theme-secondary font-medium">Cache</th>
                            <th className="text-left py-2 px-3 text-theme-secondary font-medium">Entries</th>
                            <th className="text-left py-2 px-3 text-theme-secondary font-medium">Size</th>
                            <th className="text-right py-2 px-3 text-theme-secondary font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* TMDB Metadata */}
                        <tr className="border-b border-theme-light">
                            <td className="py-3 px-3 text-theme-primary font-medium">TMDB Metadata</td>
                            <td className="py-3 px-3 text-theme-secondary">
                                {cacheStats.tmdbMetadata.count} items
                                <span className="text-xs text-theme-tertiary ml-1">
                                    ({cacheStats.tmdbMetadata.movieCount} movies, {cacheStats.tmdbMetadata.tvCount} TV)
                                </span>
                            </td>
                            <td className="py-3 px-3 text-theme-secondary">—</td>
                            <td className="py-3 px-3 text-right">
                                <FlushButton
                                    isFlushing={flushingCache === 'tmdb-metadata'}
                                    disabled={cacheStats.tmdbMetadata.count === 0}
                                    onClick={onFlushTmdbMetadata}
                                />
                            </td>
                        </tr>

                        {/* TMDB Images */}
                        <tr className="border-b border-theme-light">
                            <td className="py-3 px-3 text-theme-primary font-medium">TMDB Images</td>
                            <td className="py-3 px-3 text-theme-secondary">{cacheStats.tmdbImages.count} images</td>
                            <td className="py-3 px-3 text-theme-secondary">{formatSize(cacheStats.tmdbImages.sizeBytes)}</td>
                            <td className="py-3 px-3 text-right">
                                <FlushButton
                                    isFlushing={flushingCache === 'tmdb-images'}
                                    disabled={cacheStats.tmdbImages.count === 0}
                                    onClick={onFlushTmdbImages}
                                />
                            </td>
                        </tr>

                        {/* Library Cache - Expandable Header */}
                        {hasLibraryItems && (
                            <>
                                <tr
                                    className="border-b border-theme-light cursor-pointer hover:bg-theme-hover transition-colors"
                                    onClick={() => setLibraryExpanded(!libraryExpanded)}
                                >
                                    <td className="py-3 px-3 text-theme-primary font-medium">
                                        <span className="inline-flex items-center gap-1.5">
                                            {libraryExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            Library Cache
                                        </span>
                                    </td>
                                    <td className="py-3 px-3 text-theme-secondary">
                                        {cacheStats.library.totalImages} images
                                    </td>
                                    <td className="py-3 px-3 text-theme-secondary">
                                        {formatSize(cacheStats.library.sizeBytes)}
                                    </td>
                                    <td className="py-3 px-3 text-right" />
                                </tr>

                                {/* Per-integration rows */}
                                {libraryExpanded && cacheStats.libraryPerIntegration.map((integration) => (
                                    <tr
                                        key={integration.integrationId}
                                        className="border-b border-theme-light bg-theme-hover/30"
                                    >
                                        <td className="py-2.5 px-3 pl-10 text-theme-secondary text-xs">
                                            {integration.integrationId}
                                        </td>
                                        <td className="py-2.5 px-3 text-theme-secondary text-xs">
                                            {integration.imageCount} images
                                        </td>
                                        <td className="py-2.5 px-3 text-theme-secondary text-xs">
                                            {formatSize(integration.sizeBytes)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right">
                                            <div className="flex items-center gap-1.5 justify-end">
                                                <FlushButton
                                                    isFlushing={flushingCache === `library-${integration.integrationId}`}
                                                    onClick={() => onFlushLibrary(integration.integrationId)}
                                                    small
                                                />
                                                <button
                                                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md
                                                               bg-theme-hover text-theme-secondary hover:text-accent
                                                               transition-colors disabled:opacity-50"
                                                    disabled={syncingIntegration === integration.integrationId}
                                                    onClick={() => onSyncLibrary(integration.integrationId)}
                                                >
                                                    {syncingIntegration === integration.integrationId ? (
                                                        <Loader2 size={10} className="animate-spin" />
                                                    ) : (
                                                        <RefreshCw size={10} />
                                                    )}
                                                    Sync
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </>
                        )}

                        {/* Search History */}
                        <tr className="last:border-b-0">
                            <td className="py-3 px-3 text-theme-primary font-medium">Search History</td>
                            <td className="py-3 px-3 text-theme-secondary">{cacheStats.searchHistory.count} items</td>
                            <td className="py-3 px-3 text-theme-secondary">—</td>
                            <td className="py-3 px-3 text-right">
                                <FlushButton
                                    isFlushing={flushingCache === 'search-history'}
                                    disabled={cacheStats.searchHistory.count === 0}
                                    onClick={onClearSearchHistory}
                                    label="Clear"
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </SettingsSection>
    );
};

/** Reusable flush/clear button */
const FlushButton: React.FC<{
    isFlushing: boolean;
    onClick: () => void;
    disabled?: boolean;
    label?: string;
    small?: boolean;
}> = ({ isFlushing, onClick, disabled, label = 'Flush', small }) => (
    <button
        className={`inline-flex items-center gap-1 text-xs rounded-md transition-colors disabled:opacity-50
                    ${small ? 'px-2 py-1' : 'px-2.5 py-1.5'}
                    text-red-400 hover:bg-red-500/10 hover:text-red-300`}
        disabled={isFlushing || disabled}
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
    >
        {isFlushing ? (
            <Loader2 size={small ? 10 : 12} className="animate-spin" />
        ) : (
            <Trash2 size={small ? 10 : 12} />
        )}
        {label}
    </button>
);
