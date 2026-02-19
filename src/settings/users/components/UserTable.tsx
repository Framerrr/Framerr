/**
 * User Table Component
 * 
 * Displays the list of users with actions (edit, reset password, delete).
 * Includes inline confirmation patterns for destructive actions.
 */

import React from 'react';
import { Users as UsersIcon, Plus, Edit, Key, Check, X } from 'lucide-react';
import { Button, UserAvatar } from '../../../shared/ui';
import { ConfirmButton } from '../../../shared/ui';
import { TempPasswordModal } from './TempPasswordModal';
import type { User, TempPassword } from '../types';

interface UserTableProps {
    users: User[];
    tempPassword: TempPassword | null;
    confirmResetId: string | null;
    isAdminGroup: (group: string | undefined) => boolean;
    onEditUser: (user: User) => void;
    onDeleteUser: (userId: string, username: string) => void;
    onResetPassword: (userId: string, username: string) => void;
    onCopyTempPassword: () => void;
    onDismissTempPassword: () => void;
    setConfirmResetId: (id: string | null) => void;
}

export const UserTable: React.FC<UserTableProps> = ({
    users,
    tempPassword,
    confirmResetId,
    isAdminGroup,
    onEditUser,
    onDeleteUser,
    onResetPassword,
    onCopyTempPassword,
    onDismissTempPassword,
    setConfirmResetId,
}) => {
    return (
        <>
            <div className="rounded-xl overflow-hidden border border-theme bg-theme-tertiary" style={{ transition: 'all 0.3s ease' }}>
                <div>
                    <table className="w-full table-fixed">
                        <thead className="bg-theme-tertiary/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-theme-secondary">Username</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-theme-secondary hidden md:table-cell">Email</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-theme-secondary">Role</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-theme-secondary hidden lg:table-cell">Created</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-theme-secondary">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} className="border-t border-theme hover:bg-theme-tertiary/20 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <UserAvatar
                                                name={user.username}
                                                profilePictureUrl={user.profilePictureUrl}
                                                size="md"
                                            />
                                            <span className="font-medium text-theme-primary truncate">{user.username}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-theme-secondary text-sm hidden md:table-cell">
                                        {user.email || '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${isAdminGroup(user.group)
                                            ? 'bg-accent/20 text-accent'
                                            : 'bg-theme-tertiary text-theme-secondary'
                                            }`}>
                                            {user.group || 'user'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-theme-secondary text-sm hidden lg:table-cell">
                                        {user.createdAt ? new Date(user.createdAt * 1000).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2 justify-end items-center">

                                            <button
                                                onClick={() => onEditUser(user)}
                                                className="inline-flex items-center justify-center h-7 px-2 text-xs gap-1 rounded-lg font-medium text-accent hover:bg-white/10 transition-colors"
                                                title="Edit user"
                                            >
                                                <Edit size={16} />
                                            </button>

                                            {/* Reset Password - Inline Confirmation */}
                                            {confirmResetId !== user.id ? (
                                                <button
                                                    onClick={() => setConfirmResetId(user.id)}
                                                    className="inline-flex items-center justify-center h-7 px-2 text-xs gap-1 rounded-lg font-medium text-warning hover:bg-white/10 transition-colors hidden sm:flex"
                                                    title="Reset password"
                                                >
                                                    <Key size={16} />
                                                </button>
                                            ) : (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => onResetPassword(user.id, user.username)}
                                                        className="inline-flex items-center justify-center h-7 px-2 rounded-lg bg-warning text-white hover:bg-warning/80 transition-colors"
                                                        title="Confirm reset"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmResetId(null)}
                                                        className="inline-flex items-center justify-center h-7 px-2 rounded-lg bg-theme-tertiary text-theme-primary hover:bg-theme-hover transition-colors"
                                                        title="Cancel"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Delete - ConfirmButton */}
                                            <ConfirmButton
                                                onConfirm={() => onDeleteUser(user.id, user.username)}
                                                size="sm"
                                                confirmMode="iconOnly"
                                                anchorButton="cancel"
                                                expandDirection="left"
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {users.length === 0 && (
                    <div className="text-center py-12 text-theme-secondary">
                        <UsersIcon size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No users found. Create your first user to get started.</p>
                    </div>
                )}
            </div>

            {/* Temp Password Modal */}
            <TempPasswordModal
                tempPassword={tempPassword}
                username={tempPassword ? users.find(u => u.id === tempPassword.userId)?.username || 'User' : ''}
                onCopy={onCopyTempPassword}
                onDismiss={onDismissTempPassword}
            />
        </>
    );
};

