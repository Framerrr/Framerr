/**
 * SummaryBar — Sonarr/Radarr-style header chips, optional apps strip, Test All, then divider.
 * Healthy/failing/disabled labels collapse to numbers on narrow widgets; total stays full.
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, Layers, Loader2, PauseCircle, TestTube2 } from 'lucide-react';
import ApplicationsStrip from './ApplicationsStrip';
import type { ProwlarrApplication, ProwlarrSummary } from '../prowlarr.types';

interface SummaryBarProps {
    summary: ProwlarrSummary;
    compact?: boolean;
    applications?: ProwlarrApplication[];
    showSummaryBar?: boolean;
    showApplications?: boolean;
    isAdmin?: boolean;
    testingAll?: boolean;
    onTestAll?: () => void;
}

const SummaryBar: React.FC<SummaryBarProps> = ({
    summary,
    compact = false,
    applications = [],
    showSummaryBar = true,
    showApplications = false,
    isAdmin = false,
    testingAll = false,
    onTestAll,
}) => {
    const testButton =
        isAdmin && onTestAll ? (
            <button
                type="button"
                className={`prwl-test-all ${testingAll ? 'is-loading' : ''}`}
                onClick={onTestAll}
                disabled={testingAll}
                title="Test all indexers"
                aria-label="Test all indexers"
            >
                {testingAll ? <Loader2 size={13} className="prwl-test-all-spinner" /> : <TestTube2 size={13} />}
                <span className="prwl-test-all-label prwl-test-all-label--full">Test All</span>
                <span className="prwl-test-all-label prwl-test-all-label--short">Test</span>
            </button>
        ) : null;

    const chips = (
        <>
            <span className="prwl-header-chip prwl-header-chip--total" title={`${summary.total} total`}>
                <Layers size={11} /> {summary.total} total
            </span>
            <span className="prwl-header-chip prwl-header-chip--healthy" title={`${summary.healthy} healthy`}>
                <CheckCircle2 size={11} /> {summary.healthy}
                <span className="prwl-chip-word"> healthy</span>
            </span>
            {summary.failing > 0 && (
                <span className="prwl-header-chip prwl-header-chip--failing" title={`${summary.failing} failing`}>
                    <AlertTriangle size={11} /> {summary.failing}
                    <span className="prwl-chip-word"> failing</span>
                </span>
            )}
            {summary.disabled > 0 && (
                <span className="prwl-header-chip prwl-header-chip--disabled" title={`${summary.disabled} disabled`}>
                    <PauseCircle size={11} /> {summary.disabled}
                    <span className="prwl-chip-word"> disabled</span>
                </span>
            )}
        </>
    );

    if (compact) {
        if (!showSummaryBar && !testButton) return null;
        return (
            <div className="prwl-header-row prwl-header-row--compact">
                {showSummaryBar && (
                    <div className="prwl-header-chips prwl-header-chips--compact">{chips}</div>
                )}
                {testButton}
            </div>
        );
    }

    if (!showSummaryBar && !showApplications && !testButton) return null;

    return (
        <div className="prwl-summary-block">
            {(showSummaryBar || testButton) && (
                <div className="prwl-header-row">
                    {showSummaryBar ? (
                        <div className="prwl-header-chips">{chips}</div>
                    ) : (
                        <div className="prwl-header-chips" />
                    )}
                    {testButton}
                </div>
            )}

            {showApplications && <ApplicationsStrip applications={applications} />}

            <div className="prwl-divider" />
        </div>
    );
};

export default SummaryBar;
