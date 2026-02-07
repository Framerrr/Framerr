/**
 * PictureSection
 * 
 * Profile picture display and upload/remove functionality.
 */

import React from 'react';
import { UserCircle, Upload } from 'lucide-react';
import { Button, ConfirmButton } from '../../../shared/ui';
import { SettingsSection } from '../../../shared/ui/settings';

interface PictureSectionProps {
    profilePicture: string | null;
    uploadingPicture: boolean;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemove: () => void;
}

export const PictureSection: React.FC<PictureSectionProps> = ({
    profilePicture,
    uploadingPicture,
    fileInputRef,
    onUpload,
    onRemove,
}) => {
    return (
        <SettingsSection title="Profile Picture" icon={UserCircle}>
            <div className="flex items-center gap-6 pt-2">
                {/* Picture Display */}
                <div className="relative">
                    {profilePicture ? (
                        <div className="relative">
                            <img
                                src={profilePicture}
                                alt="Profile"
                                className="w-24 h-24 min-w-[80px] min-h-[80px] max-w-[120px] max-h-[120px] aspect-square rounded-full object-cover border-2 border-theme"
                            />
                            <div className="absolute -top-2 -right-2">
                                <ConfirmButton
                                    onConfirm={onRemove}
                                    label="Remove"
                                    confirmMode="iconOnly"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="w-24 h-24 min-w-[80px] min-h-[80px] max-w-[120px] max-h-[120px] aspect-square rounded-full bg-theme-tertiary flex items-center justify-center">
                            <UserCircle size={48} className="text-theme-tertiary" />
                        </div>
                    )}
                </div>

                {/* Upload Button */}
                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={onUpload}
                        disabled={uploadingPicture}
                        className="hidden"
                    />
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPicture}
                        icon={Upload}
                        size="md"
                        textSize="sm"
                    >
                        <span className="profile-btn-text">
                            {uploadingPicture ? 'Uploading...' : (profilePicture ? 'Change' : 'Upload')}
                        </span>
                    </Button>
                    <p className="hidden sm:block text-xs text-theme-tertiary mt-2">
                        Any image up to 20MB. Auto-compressed.
                    </p>
                </div>
            </div>
        </SettingsSection>
    );
};
