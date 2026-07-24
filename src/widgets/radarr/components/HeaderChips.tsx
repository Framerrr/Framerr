import React from 'react';
import { CalendarDays, Circle, AlertTriangle, ArrowUpCircle, Download } from 'lucide-react';

export interface HeaderChipsProps {
    upcomingCount: number;
    cinemaCount: number;
    missingCount: number;
    cutoffUnmetCount: number;
    downloadingCount: number;
}

const HeaderChips: React.FC<HeaderChipsProps> = ({
    upcomingCount,
    cinemaCount,
    missingCount,
    cutoffUnmetCount,
    downloadingCount,
}) => (
    <div className="rdr-header-chips">
        <span className="rdr-header-chip rdr-header-chip--upcoming">
            <CalendarDays size={11} /> {upcomingCount} upcoming
        </span>
        {cinemaCount > 0 && (
            <span className="rdr-header-chip rdr-header-chip--cinema">
                <Circle size={9} fill="currentColor" /> {cinemaCount} Cinema
            </span>
        )}
        {missingCount > 0 && (
            <span className="rdr-header-chip rdr-header-chip--missing">
                <AlertTriangle size={11} /> {missingCount} missing
            </span>
        )}
        {cutoffUnmetCount > 0 && (
            <span className="rdr-header-chip rdr-header-chip--cutoff">
                <ArrowUpCircle size={11} /> {cutoffUnmetCount} upgrade
            </span>
        )}
        {downloadingCount > 0 && (
            <span className="rdr-header-chip rdr-header-chip--downloading">
                <Download size={11} /> {downloadingCount} downloading
            </span>
        )}
    </div>
);

export default HeaderChips;
