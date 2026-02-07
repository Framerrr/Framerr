/**
 * MonitorForm - Thin orchestrator for service monitoring form
 * 
 * Main form for managing Framerr's first-party service monitors.
 * Handles monitor CRUD, drag-and-drop reordering, and integration imports.
 * 
 * Refactored in Phase 1.5.2 - logic extracted to useMonitorForm hook.
 */

import React, { forwardRef, useImperativeHandle, useEffect } from 'react';
import { AlertCircle, Loader } from 'lucide-react';
import {
    DndContext,
    closestCenter,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import MonitorCard from './MonitorCard';
import SortableMonitorItem from './components/SortableMonitorItem';
import FormActionBar from './components/FormActionBar';
import { useMonitorForm } from './hooks/useMonitorForm';
import type { MonitorFormProps, MonitorFormRef, IntegrationConfig, Monitor, MaintenanceSchedule } from './types';

const MonitorForm = forwardRef<MonitorFormRef, MonitorFormProps>((
    { instanceId, integrations = {}, onReady },
    ref
) => {
    const {
        // State
        monitors,
        newMonitors,
        expandedId,
        loading,
        error,
        testStates,
        importDropdownOpen,
        importTriggerRef,
        sensors,

        // Actions
        setExpandedId,
        setImportDropdownOpen,
        handleAddMonitor,
        handleImport,
        handleMonitorChange,
        handleDeleteMonitor,
        handleTestMonitor,
        handleCancelNew,
        handleDragEnd,
        saveAll,
        resetAll,

        // Computed
        allMonitors,
        getConfiguredIntegrations,
        importedIntegrationIds,
    } = useMonitorForm({ instanceId, integrations: integrations as Record<string, IntegrationConfig> });

    // Expose saveAll and resetAll methods to parent via ref
    useImperativeHandle(ref, () => ({
        saveAll,
        resetAll
    }), [saveAll, resetAll]);

    // Notify parent that the form is ready (ref methods available)
    useEffect(() => {
        onReady?.();
    }, [onReady]);

    // Get available integrations (not already monitored)
    const availableIntegrations = getConfiguredIntegrations().filter(
        int => !importedIntegrationIds.has(int.id)
    );

    return (
        <div className="flex flex-col gap-4">
            {/* Action Bar */}
            <FormActionBar
                onAddMonitor={handleAddMonitor}
                importDropdownOpen={importDropdownOpen}
                onImportDropdownToggle={() => setImportDropdownOpen(!importDropdownOpen)}
                onImportDropdownClose={() => setImportDropdownOpen(false)}
                importTriggerRef={importTriggerRef}
                availableIntegrations={availableIntegrations}
                onImport={handleImport}
            />

            {/* Error message */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-error/10 border border-error/20 rounded-xl text-error text-sm flex-shrink-0">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {/* Scrollable Monitor List */}
            <div className="overflow-y-auto flex-1 min-h-0 -mx-2 px-2">
                {/* Loading state */}
                {loading && (
                    <div className="flex items-center justify-center py-8 text-theme-secondary">
                        <Loader className="animate-spin mr-2" size={20} />
                        Loading monitors...
                    </div>
                )}

                {/* Unified Monitor List (new + existing, all sortable) */}
                {!loading && (
                    <div className="space-y-3">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={allMonitors.map(m => m.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {allMonitors.map(monitor => {
                                    const isNew = monitor.id.startsWith('new-');
                                    return (
                                        <SortableMonitorItem
                                            key={monitor.id}
                                            id={monitor.id}
                                            isExpanded={expandedId === monitor.id}
                                        >
                                            <MonitorCard
                                                monitor={monitor}
                                                isExpanded={expandedId === monitor.id}
                                                isNew={isNew}
                                                onToggleExpand={() => setExpandedId(
                                                    expandedId === monitor.id ? null : monitor.id
                                                )}
                                                onChange={(field: keyof Monitor, value: string | number | boolean | MaintenanceSchedule | null) => handleMonitorChange(monitor.id, field, value)}
                                                onDelete={isNew ? () => handleCancelNew(monitor.id) : () => handleDeleteMonitor(monitor.id)}
                                                onTest={() => handleTestMonitor(monitor.id)}
                                                testState={testStates[monitor.id]}
                                            />
                                        </SortableMonitorItem>
                                    );
                                })}
                            </SortableContext>
                        </DndContext>

                        {/* Empty state */}
                        {newMonitors.length === 0 && monitors.length === 0 && (
                            <div className="text-center py-8 text-theme-secondary">
                                <p className="text-sm">No monitors configured</p>
                                <p className="text-xs mt-1">
                                    Click "Add Monitor" or import from an integration
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

export default MonitorForm;
