/**
 * Permission Settings - Thin Orchestrator
 * Composes the permission groups management UI
 */
import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../shared/ui';
import { Select } from '../../shared/ui';
import { usePermissionSettings } from './hooks/usePermissionSettings';
import { GroupCard } from './components/GroupCard';
import { GroupFormModal } from './components/GroupFormModal';
import { useSettingsAnimationClass } from '../../context/SettingsAnimationContext';

const PermissionSettings: React.FC = () => {
    const {
        groups,
        defaultGroup,
        loading,
        showModal,
        modalMode,
        selectedGroup,
        formData,
        setShowModal,
        setFormData,
        handleCreate,
        handleEdit,
        handleSubmit,
        handleDelete,
        handleDefaultGroupChange,
        togglePermission,
        generateGroupId
    } = usePermissionSettings();

    // Animation class - only animates on first render
    const animClass = useSettingsAnimationClass('permissions');

    if (loading) {
        return <div className="text-center py-16 text-theme-secondary">Loading permission groups...</div>;
    }

    return (
        <div className={animClass}>
            {/* Header */}
            <div className="mb-6 text-center">
                <h2 className="text-2xl md:text-3xl font-bold mb-2 text-theme-primary">Permission Groups</h2>
                <p className="text-theme-secondary text-sm">Manage access control and user permissions</p>
            </div>

            {/* Add Button */}
            <div className="mb-6 flex justify-center">
                <Button
                    onClick={handleCreate}
                    title="Add new permission group"
                    icon={Plus}
                >
                    <span className="hidden sm:inline">Add Group</span>
                </Button>
            </div>

            {/* Default Group */}
            <div className="mb-6 p-4 rounded-xl border border-theme bg-theme-tertiary/30" style={{ transition: 'all 0.3s ease' }}>
                <label className="block mb-2 font-medium text-theme-primary">Default Group for New Users</label>
                <p className="text-sm text-theme-secondary mb-3">New users are automatically assigned to this group</p>
                <Select value={defaultGroup} onValueChange={(value) => handleDefaultGroupChange(value)}>
                    <Select.Trigger className="w-full">
                        <Select.Value placeholder="Select default group" />
                    </Select.Trigger>
                    <Select.Content>
                        {groups.map(g => (
                            <Select.Item key={g.id} value={g.id}>{g.name}</Select.Item>
                        ))}
                    </Select.Content>
                </Select>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map(group => (
                    <GroupCard
                        key={group.id}
                        group={group}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                ))}
            </div>

            {/* Modal */}
            <GroupFormModal
                show={showModal}
                mode={modalMode}
                selectedGroup={selectedGroup}
                formData={formData}
                onClose={() => setShowModal(false)}
                onSubmit={handleSubmit}
                onFormDataChange={setFormData}
                onTogglePermission={togglePermission}
                generateGroupId={generateGroupId}
            />
        </div>
    );
};

export default PermissionSettings;
