/**
 * Individual permission group card component
 */
import React from 'react';
import { Shield, Edit } from 'lucide-react';
import { ConfirmButton } from '../../../shared/ui';
import { PermissionGroup, PROTECTED_GROUPS } from '../types';

interface GroupCardProps {
    group: PermissionGroup;
    onEdit: (group: PermissionGroup) => void;
    onDelete: (group: PermissionGroup) => void;
}

export const GroupCard: React.FC<GroupCardProps> = ({
    group,
    onEdit,
    onDelete,
}) => {
    const isProtected = PROTECTED_GROUPS.includes(group.id);
    const hasFullAccess = group.permissions.includes('*');

    return (
        <div
            className="rounded-xl p-6 border border-theme bg-theme-tertiary/30 hover:bg-theme-tertiary/50 hover:border-theme-light transition-all flex flex-col"
            style={{ transition: 'all 0.3s ease' }}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1">
                    <Shield size={20} className={hasFullAccess ? 'text-accent' : 'text-info'} />
                    <h3 className="font-semibold text-theme-primary truncate">{group.name}</h3>
                </div>
                {isProtected && (
                    <span className="px-2 py-0.5 bg-warning/20 text-warning rounded text-xs font-medium ml-2">System</span>
                )}
            </div>

            {/* Permission Count */}
            <div className="mb-4">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${hasFullAccess ? 'bg-accent/20 text-accent' : 'bg-info/20 text-info'}`}>
                    {hasFullAccess ? 'All Permissions' : `${group.permissions.length} Permission${group.permissions.length === 1 ? '' : 's'}`}
                </span>
            </div>

            {/* Group ID */}
            <div className="text-xs text-theme-tertiary mb-4">ID: {group.id}</div>

            {/* Actions */}
            <div className="flex gap-2 mt-auto">
                <button
                    onClick={() => onEdit(group)}
                    className="flex-1 inline-flex items-center justify-center h-7 px-2 text-xs gap-1 rounded-lg font-medium text-accent hover:bg-white/10 transition-colors"
                    title="Edit group"
                >
                    <Edit size={14} />
                    <span className="hidden sm:inline">Edit</span>
                </button>

                <div className="flex-1">
                    <ConfirmButton
                        onConfirm={() => onDelete(group)}
                        label="Delete"
                        size="sm"
                        disabled={isProtected}
                        className="w-full"
                    />
                </div>
            </div>
        </div>
    );
};

