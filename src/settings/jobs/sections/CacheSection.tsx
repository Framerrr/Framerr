/**
 * CacheSection - Cache stats display with flush/sync actions
 * 
 * Expandable table showing TMDB metadata, TMDB images, library cache
 * (per-integration breakdown), and search history.
 */

import React, { useState } from 'react';
import { Database, Trash2, RefreshCw, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '../../../shared/ui';
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
    onFlushAllLibrary: () => void;
    onSyncLibrary: (integrationId: string) => void;
    onFlushMetricHistory: () => void;
    onFlushMetricHistoryIntegration: (integrationId: string) => void;
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
    onFlushAllLibrary,
    onSyncLibrary,
    onFlushMetricHistory,
    onFlushMetricHistoryIntegration,
}) => {
    const [libraryExpanded, setLibraryExpanded] = useState(false);
    const [metricHistoryExpanded, setMetricHistoryExpanded] = useState(false);

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
                <table className="w-full text-sm table-fixed">
                    <colgroup>
                        <col className="w-[40%]" />
                        <col className="w-[20%]" />
                        <col className="w-[15%]" />
                        <col className="w-[25%]" />
                    </colgroup>
                    <thead>
                        <tr className="border-b border-theme-light">
                            <th className="text-center py-2 px-3 text-theme-secondary font-medium">Cache</th>
                            <th className="text-center py-2 px-3 text-theme-secondary font-medium">Entries</th>
                            <th className="text-center py-2 px-3 text-theme-secondary font-medium">Size</th>
                            <th className="text-center py-2 px-3 text-theme-secondary font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* TMDB Metadata */}
                        <tr className="border-b border-theme-light">
                            <td className="py-3 px-3 text-theme-primary font-medium">TMDB Metadata</td>
                            <td className="py-3 px-3 text-center text-theme-secondary">
                                {cacheStats.tmdbMetadata.count} items
                                <span className="text-xs text-theme-tertiary ml-1">
                                    ({cacheStats.tmdbMetadata.movieCount} movies, {cacheStats.tmdbMetadata.tvCount} TV)
                                </span>
                            </td>
                            <td className="py-3 px-3 text-center text-theme-secondary">—</td>
                            <td className="py-3 px-3">
                                <div className="flex flex-col items-end gap-1">
                                    <FlushButton
                                        isFlushing={flushingCache === 'tmdb-metadata'}
                                        disabled={cacheStats.tmdbMetadata.count === 0}
                                        onClick={onFlushTmdbMetadata}
                                    />
                                </div>
                            </td>
                        </tr>

                        {/* TMDB Images */}
                        <tr className="border-b border-theme-light">
                            <td className="py-3 px-3 text-theme-primary font-medium">TMDB Images</td>
                            <td className="py-3 px-3 text-center text-theme-secondary">{cacheStats.tmdbImages.count} images</td>
                            <td className="py-3 px-3 text-center text-theme-secondary">{formatSize(cacheStats.tmdbImages.sizeBytes)}</td>
                            <td className="py-3 px-3">
                                <div className="flex flex-col items-end gap-1">
                                    <FlushButton
                                        isFlushing={flushingCache === 'tmdb-images'}
                                        disabled={cacheStats.tmdbImages.count === 0}
                                        onClick={onFlushTmdbImages}
                                    />
                                </div>
                            </td>
                        </tr>

                        {/* Library Cache - Expandable Header */}
                        {hasLibraryItems && (
                            <>
                                <tr
                                    className="border-b border-theme-light cursor-pointer [@media(hover:hover)]:hover:bg-theme-hover transition-colors"
                                    onClick={() => setLibraryExpanded(!libraryExpanded)}
                                >
                                    <td className="py-3 px-3 text-theme-primary font-medium">
                                        <span className="inline-flex items-center gap-1.5">
                                            {libraryExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            Library Cache
                                        </span>
                                    </td>
                                    <td className="py-3 px-3 text-center text-theme-secondary">
                                        {cacheStats.library.totalImages} images
                                    </td>
                                    <td className="py-3 px-3 text-center text-theme-secondary">
                                        {formatSize(cacheStats.library.sizeBytes)}
                                    </td>
                                    <td className="py-3 px-3">
                                        <div className="flex flex-col items-end gap-1">
                                            <FlushButton
                                                isFlushing={flushingCache === 'library-all'}
                                                onClick={onFlushAllLibrary}
                                                label={<><span className="hidden sm:inline">Flush </span>All</>}
                                            />
                                        </div>
                                    </td>
                                </tr>

                                {/* Per-integration rows */}
                                {libraryExpanded && cacheStats.libraryPerIntegration.map((integration) => (
                                    <tr
                                        key={integration.integrationId}
                                        className="border-b border-theme-light bg-theme-hover/30"
                                    >
                                        <td className="py-2.5 px-3 pl-10 text-theme-secondary text-xs overflow-hidden text-ellipsis">
                                            {integration.displayName || integration.integrationId}
                                        </td>
                                        <td className="py-2.5 px-3 text-center text-theme-secondary text-xs">
                                            {integration.imageCount} images
                                        </td>
                                        <td className="py-2.5 px-3 text-center text-theme-secondary text-xs">
                                            {formatSize(integration.sizeBytes)}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <div className="flex flex-col items-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={RefreshCw}
                                                    loading={syncingIntegration === integration.integrationId}
                                                    onClick={() => onSyncLibrary(integration.integrationId)}
                                                    className="text-accent bg-accent/10 hover:bg-accent/20"
                                                >
                                                    Sync
                                                </Button>
                                                <FlushButton
                                                    isFlushing={flushingCache === `library-${integration.integrationId}`}
                                                    onClick={() => onFlushLibrary(integration.integrationId)}
                                                    small
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </>
                        )}

                        {/* Search History */}
                        <tr className="last:border-b-0">
                            <td className="py-3 px-3 text-theme-primary font-medium">Search History</td>
                            <td className="py-3 px-3 text-center text-theme-secondary">{cacheStats.searchHistory.count} items</td>
                            <td className="py-3 px-3 text-center text-theme-secondary">—</td>
                            <td className="py-3 px-3">
                                <div className="flex flex-col items-end gap-1">
                                    <FlushButton
                                        isFlushing={flushingCache === 'search-history'}
                                        disabled={cacheStats.searchHistory.count === 0}
                                        onClick={onClearSearchHistory}
                                        label="Clear"
                                    />
                                </div>
                            </td>
                        </tr>

                        {/* Metric History - Expandable */}
                        {cacheStats.metricHistory && cacheStats.metricHistory.totalDataPoints > 0 && (
                            <>
                                <tr
                                    className="border-b border-theme-light cursor-pointer [@media(hover:hover)]:hover:bg-theme-hover transition-colors"
                                    onClick={() => setMetricHistoryExpanded(!metricHistoryExpanded)}
                                >
                                    <td className="py-3 px-3 text-theme-primary font-medium">
                                        <span className="inline-flex items-center gap-1.5">
                                            {metricHistoryExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            Metric History
                                        </span>
                                    </td>
                                    <td className="py-3 px-3 text-center text-theme-secondary">
                                        {cacheStats.metricHistory.totalDataPoints.toLocaleString()} points
                                    </td>
                                    <td className="py-3 px-3 text-center text-theme-secondary">—</td>
                                    <td className="py-3 px-3">
                                        <div className="flex flex-col items-end gap-1">
                                            <FlushButton
                                                isFlushing={flushingCache === 'metric-history'}
                                                onClick={onFlushMetricHistory}
                                                label={<><span className="hidden sm:inline">Flush </span>All</>}
                                            />
                                        </div>
                                    </td>
                                </tr>

                                {/* Per-integration rows */}
                                {metricHistoryExpanded && cacheStats.metricHistory.integrations.map((integration) => (
                                    <tr
                                        key={integration.integrationId}
                                        className="border-b border-theme-light bg-theme-hover/30"
                                    >
                                        <td className="py-2.5 px-3 pl-10 text-theme-secondary text-xs overflow-hidden text-ellipsis">
                                            {integration.displayName}
                                        </td>
                                        <td className="py-2.5 px-3 text-center text-theme-secondary text-xs">
                                            {integration.dataPoints.toLocaleString()} points
                                        </td>
                                        <td className="py-2.5 px-3 text-center text-theme-secondary text-xs">—</td>
                                        <td className="py-2.5 px-3">
                                            <div className="flex flex-col items-end gap-1">
                                                <FlushButton
                                                    isFlushing={flushingCache === `metric-history-${integration.integrationId}`}
                                                    onClick={() => onFlushMetricHistoryIntegration(integration.integrationId)}
                                                    small
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </>
                        )}
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
    label?: React.ReactNode;
    small?: boolean;
}> = ({ isFlushing, onClick, disabled, label = 'Flush', small }) => (
    <Button
        variant="ghost"
        size="sm"
        icon={Trash2}
        loading={isFlushing}
        disabled={disabled}
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        className="!text-red-400 !bg-red-500/10 hover:!bg-red-500/20 hover:!text-red-300"
    >
        {label}
    </Button>
);
