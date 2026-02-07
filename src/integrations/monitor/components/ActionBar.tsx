/**
 * ActionBar - Action buttons for MonitorCard
 * Delete, Share dropdown, Test button with status
 */

import React from 'react';
import {
    Trash2,
    TestTube,
    Loader,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { Button } from '../../../shared/ui';
import MonitorSharingDropdown from '../MonitorSharingDropdown';
import { ActionBarProps } from '../types';

const ActionBar: React.FC<ActionBarProps> = ({
    monitor,
    isNew,
    isReadonly,
    onDelete,
    onTest,
    testState,
    eligibleUsers = [],
    sharedUserIds = [],
    onShareChange
}) => {
    return (
        <div className="flex items-center justify-between pt-2 border-t border-theme">
            <div className="flex items-center gap-2">
                {/* Delete/Remove button - always visible */}
                <Button
                    onClick={onDelete}
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                >
                    {isNew ? 'Remove' : (isReadonly ? 'Remove' : 'Delete')}
                </Button>
            </div>
            <div className="flex items-center gap-2">
                {/* Share button - only for saved monitors with eligible users */}
                {!isNew && onShareChange && eligibleUsers.length > 0 && (
                    <MonitorSharingDropdown
                        monitorId={monitor.id}
                        monitorName={monitor.name || 'This monitor'}
                        eligibleUsers={eligibleUsers}
                        selectedUserIds={sharedUserIds}
                        onSelectionChange={onShareChange}
                    />
                )}
                {/* Test button - always available */}
                <Button
                    onClick={onTest}
                    disabled={testState?.loading || !monitor.name || (!isReadonly && monitor.type === 'http' && !monitor.url)}
                    variant={testState && !testState.loading
                        ? (testState.success ? 'primary' : 'danger')
                        : 'secondary'
                    }
                    size="sm"
                    icon={testState?.loading
                        ? Loader
                        : (testState?.success
                            ? CheckCircle2
                            : testState
                                ? AlertCircle
                                : TestTube
                        )
                    }
                >
                    {testState?.loading ? 'Testing...' :
                        testState?.success ? 'Success' :
                            testState ? 'Failed' : 'Test'}
                </Button>
            </div>
        </div>
    );
};

export default ActionBar;
