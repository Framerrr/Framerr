// Backup Settings Utility Functions

import { FolderArchive, Clock, Shield } from 'lucide-react';

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format ISO date string to full date/time
 */
export function formatDate(isoString: string | null | undefined): string {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    // Check for invalid date or epoch (1970-01-01)
    if (isNaN(date.getTime()) || date.getFullYear() <= 1970) return 'Never';
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format date to short MM/DD/YY format
 */
export function formatDateShort(dateString: string | null | undefined): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    // Check for invalid date or epoch (1970-01-01)
    if (isNaN(date.getTime()) || date.getFullYear() <= 1970) return 'Never';
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
}

/**
 * Format hour to 12-hour time format
 */
export function formatTime(hour: number): string {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h}:00 ${ampm}`;
}

/**
 * Get icon component for backup type
 */
export function getTypeIcon(type: 'manual' | 'scheduled' | 'safety') {
    switch (type) {
        case 'manual': return FolderArchive;
        case 'scheduled': return Clock;
        case 'safety': return Shield;
    }
}

/**
 * Get label text for backup type
 */
export function getTypeLabel(type: 'manual' | 'scheduled' | 'safety'): string {
    switch (type) {
        case 'manual': return 'Manual';
        case 'scheduled': return 'Scheduled';
        case 'safety': return 'Safety';
    }
}
