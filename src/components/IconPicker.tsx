import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Upload, ChevronDown, LucideIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import logger from '../utils/logger';
import { getIconComponent, POPULAR_ICONS } from '../utils/iconUtils';
import { useNotifications } from '../context/NotificationContext';
import { Popover, ConfirmButton } from '../shared/ui';

interface UploadedIcon {
    id: string;
    originalName: string;
    isSystem?: boolean;
}

interface SystemIcon {
    name: string;
    displayName: string;
    category: string;
}

type TabType = 'icons' | 'upload';

export interface IconPickerProps {
    value?: string;
    onChange: (iconName: string) => void;
    compact?: boolean;
}

const IconPicker = ({ value, onChange, compact = false }: IconPickerProps): React.JSX.Element => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [search, setSearch] = useState<string>('');
    const [activeTab, setActiveTab] = useState<TabType>('icons');
    const [uploadedIcons, setUploadedIcons] = useState<UploadedIcon[]>([]);
    const [systemIcons, setSystemIcons] = useState<SystemIcon[]>([]);
    const [cdnCatalog, setCdnCatalog] = useState<string[]>([]);
    const [loadingIcons, setLoadingIcons] = useState<boolean>(false);
    const [uploadSearch, setUploadSearch] = useState<string>('');
    const [systemCollapsed, setSystemCollapsed] = useState<boolean>(false);
    const [userCollapsed, setUserCollapsed] = useState<boolean>(false);
    const [triggerWidth, setTriggerWidth] = useState<number>(0);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const { error: showError } = useNotifications();

    // Fetch all icon data on mount
    useEffect(() => {
        fetchUploadedIcons();
        fetchSystemIcons();
        fetchCdnCatalog();
    }, []);

    // Measure trigger width when popover opens
    useEffect(() => {
        if (isOpen && triggerRef.current) {
            setTriggerWidth(triggerRef.current.offsetWidth);
        }
    }, [isOpen]);

    const fetchUploadedIcons = async (): Promise<void> => {
        try {
            setLoadingIcons(true);
            const response = await fetch('/api/custom-icons', {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                // Filter out old system icons (is_system=1) — we use the new system now
                const userIcons = (data.icons || []).filter((i: UploadedIcon) => !i.isSystem);
                setUploadedIcons(userIcons);
            }
        } catch (error) {
            logger.error('Failed to fetch uploaded icons:', { error });
        } finally {
            setLoadingIcons(false);
        }
    };

    const fetchSystemIcons = async (): Promise<void> => {
        try {
            const response = await fetch('/api/icons/system');
            if (response.ok) {
                const data = await response.json();
                setSystemIcons(data.icons || []);
            }
        } catch (error) {
            logger.error('Failed to fetch system icons:', { error });
        }
    };

    const fetchCdnCatalog = async (): Promise<void> => {
        try {
            const response = await fetch('/api/icons/catalog');
            if (response.ok) {
                const data = await response.json();
                setCdnCatalog(data.icons || []);
            }
        } catch (error) {
            logger.error('Failed to fetch CDN catalog:', { error });
        }
    };

    // Get current icon component using centralized utility
    const getCurrentIcon = (): React.FC<{ size?: number }> => {
        return getIconComponent(value);
    };

    // Get friendly display name for current icon
    const getIconDisplayName = (): string => {
        if (!value) return 'Server';

        // Handle system icons
        if (value.startsWith('system:')) {
            const name = value.replace('system:', '');
            const si = systemIcons.find(i => i.name === name);
            return si ? si.displayName : name;
        }

        // Handle CDN icons
        if (value.startsWith('cdn:')) {
            const name = value.replace('cdn:', '');
            return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }

        // Handle custom uploaded icons - show original filename
        if (value.startsWith('custom:')) {
            const iconId = value.replace('custom:', '');
            const customIcon = uploadedIcons.find(icon => icon.id === iconId);
            if (customIcon) {
                return customIcon.originalName.replace(/\.[^/.]+$/, '');
            }
            return 'Custom Icon';
        }

        // Handle legacy base64
        if (value.startsWith('data:image')) {
            return 'Uploaded Image';
        }

        // Lucide icon
        return value.replace(/([A-Z])/g, ' $1').trim();
    };

    const CurrentIcon = getCurrentIcon();

    // Filter icons based on search
    const filteredIcons = POPULAR_ICONS.filter(icon =>
        icon.toLowerCase().includes(search.toLowerCase())
    );

    const handleIconSelect = (iconName: string): void => {
        onChange(iconName);
        setIsOpen(false);
        setSearch('');
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Create FormData for file upload
        const formData = new FormData();
        formData.append('icon', file);

        try {
            const response = await fetch('/api/custom-icons', {
                method: 'POST',
                credentials: 'include',
                headers: { 'X-Framerr-Client': '1' },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                // Set the newly uploaded icon as selected
                onChange(`custom:${data.icon.id}`);
                // Refresh the icons list
                await fetchUploadedIcons();
                setIsOpen(false);
            } else {
                showError('Upload Failed', 'Failed to upload icon');
            }
        } catch (error) {
            logger.error('Failed to upload icon:', { error });
            showError('Upload Failed', 'Failed to upload icon');
        }

        // Reset the input
        e.target.value = '';
    };

    const handleDeleteIcon = async (iconId: string): Promise<void> => {
        try {
            const response = await fetch(`/api/custom-icons/${iconId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'X-Framerr-Client': '1' }
            });

            if (response.ok) {
                // Refresh the icon list
                await fetchUploadedIcons();
                // If the deleted icon was selected, clear selection
                if (value === `custom:${iconId}`) {
                    onChange('Server');
                }
            } else {
                showError('Delete Failed', 'Failed to delete icon');
            }
        } catch (error) {
            logger.error('Failed to delete icon:', { error });
            showError('Delete Failed', 'Failed to delete icon');
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen} closeOnScroll={false}>
            <Popover.Trigger asChild>
                <button
                    ref={triggerRef}
                    type="button"
                    className={compact
                        ? "flex items-center justify-center p-[15px] aspect-square bg-theme-tertiary border border-theme rounded-lg text-theme-primary hover:border-accent hover:bg-theme-hover transition-colors"
                        : "flex items-center gap-2 px-4 py-2.5 bg-theme-tertiary border border-theme rounded-lg text-theme-primary hover:border-accent hover:bg-theme-hover transition-colors w-full"
                    }
                    title={getIconDisplayName()}
                >
                    <CurrentIcon size={compact ? 18 : 20} />
                    {!compact && (
                        <>
                            <span className="flex-1 text-left truncate">{getIconDisplayName()}</span>
                            <Search size={16} className="text-theme-secondary" />
                        </>
                    )}
                </button>
            </Popover.Trigger>

            <Popover.Content
                align="start"
                sideOffset={8}
                className="w-[min(calc(100vw-48px),24rem)] min-w-[280px] max-w-[24rem] max-h-[min(400px,calc(100vh-200px))] p-0 flex flex-col"
                onPointerDownOutside={(e) => {
                    // On iOS, tapping inputs inside portal content can trigger false 
                    // "outside" dismissals. Prevent automatic dismiss — the IconPicker 
                    // closes via the X button or icon selection instead.
                    e.preventDefault();
                }}
            >
                {/* Header - fixed */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-theme flex-shrink-0">
                    <h3 className="text-sm font-semibold text-theme-primary">Select Icon</h3>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-theme-secondary hover:text-theme-primary transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>


                {/* Tabs - fixed */}
                <div className="flex border-b border-theme relative flex-shrink-0">
                    {/* Sliding indicator */}
                    {activeTab === 'icons' ? (
                        <motion.div
                            layoutId="iconPickerTabIndicator"
                            className="absolute bottom-0 left-0 right-1/2 h-0.5 bg-accent"
                            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                        />
                    ) : (
                        <motion.div
                            layoutId="iconPickerTabIndicator"
                            className="absolute bottom-0 left-1/2 right-0 h-0.5 bg-accent"
                            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                        />
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveTab('icons');
                        }}
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'icons'
                            ? 'text-accent'
                            : 'text-theme-secondary hover:text-theme-primary'
                            }`}
                    >
                        Icons
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveTab('upload');
                        }}
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'upload'
                            ? 'text-accent'
                            : 'text-theme-secondary hover:text-theme-primary'
                            }`}
                    >
                        Upload
                    </button>
                </div>

                {/* Content - scrollable */}
                <div
                    className="p-4 flex-1 min-h-0 overflow-y-auto"
                    style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
                >
                    <AnimatePresence mode="wait">
                        {activeTab === 'icons' ? (
                            <motion.div
                                key="icons"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                            >
                                {/* Search */}
                                <div className="mb-4">
                                    <div className="relative">
                                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
                                        <input
                                            type="text"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search icons..."
                                            className="w-full pl-10 pr-4 py-2 bg-theme-secondary border-theme rounded-lg text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Icon Grid */}
                                <div className="grid grid-cols-6 gap-2">
                                    {filteredIcons.map(iconName => {
                                        const IconComponent = (Icons as unknown as Record<string, LucideIcon>)[iconName] || Icons.Server;
                                        const isSelected = value === iconName;

                                        return (
                                            <motion.button
                                                key={iconName}
                                                type="button"
                                                onClick={() => handleIconSelect(iconName)}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                                className={`p-3 rounded-lg transition-colors ${isSelected
                                                    ? 'bg-accent text-white'
                                                    : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-hover hover:text-theme-primary'
                                                    }`}
                                                title={iconName}
                                            >
                                                <IconComponent size={20} />
                                            </motion.button>
                                        );
                                    })}
                                </div>

                                {filteredIcons.length === 0 && (
                                    <div className="text-center py-8 text-theme-secondary">
                                        No icons found matching "{search}"
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            /* Upload Tab */
                            <motion.div
                                key="upload"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                                className="space-y-4"
                            >
                                {/* Upload Button */}
                                <label className="flex items-center justify-center gap-2 px-4 py-3 bg-accent hover:bg-accent/80 text-white rounded-lg cursor-pointer transition-colors w-full">
                                    <Upload size={18} />
                                    <span>Upload New Icon</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="hidden"
                                    />
                                </label>
                                <p className="text-xs text-theme-tertiary text-center">
                                    Recommended: 512x512px, PNG or SVG (max 5MB)
                                </p>

                                {/* Search bar for upload tab */}
                                <div className="relative">
                                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
                                    <input
                                        type="text"
                                        value={uploadSearch}
                                        onChange={(e) => setUploadSearch(e.target.value)}
                                        placeholder="Search 2000+ icons..."
                                        className="w-full pl-10 pr-4 py-2 bg-theme-secondary border-theme rounded-lg text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-colors"
                                    />
                                </div>

                                {uploadSearch ? (
                                    /* Search Results — combined bundled + CDN */
                                    <div>
                                        <h4 className="text-xs font-medium text-theme-secondary uppercase tracking-wider mb-2">Search Results</h4>
                                        {(() => {
                                            const q = uploadSearch.toLowerCase();
                                            // Bundled matches first
                                            const bundledMatches = systemIcons.filter(i =>
                                                i.name.includes(q) || i.displayName.toLowerCase().includes(q)
                                            );
                                            // CDN matches (exclude already bundled)
                                            const bundledNames = new Set(systemIcons.map(i => i.name));
                                            const cdnMatches = cdnCatalog
                                                .filter(name => name.includes(q) && !bundledNames.has(name))
                                                .slice(0, 24); // Limit CDN results

                                            if (bundledMatches.length === 0 && cdnMatches.length === 0) {
                                                return (
                                                    <div className="text-center py-6 text-theme-secondary">
                                                        <p className="text-sm">No icons found for "{uploadSearch}"</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="grid grid-cols-4 gap-2">
                                                    {/* Bundled results */}
                                                    {bundledMatches.map(icon => {
                                                        const iconValue = `system:${icon.name}`;
                                                        const isSelected = value === iconValue;
                                                        return (
                                                            <motion.button
                                                                key={icon.name}
                                                                type="button"
                                                                onClick={() => handleIconSelect(iconValue)}
                                                                whileHover={{ scale: 1.05 }}
                                                                whileTap={{ scale: 0.95 }}
                                                                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                                                className={`aspect-square p-2 rounded-lg transition-colors ${isSelected
                                                                    ? 'bg-accent ring-2 ring-accent/50'
                                                                    : 'bg-theme-tertiary hover:bg-theme-hover'
                                                                    }`}
                                                                title={icon.displayName}
                                                            >
                                                                <img
                                                                    src={`/api/icons/system/${icon.name}/file`}
                                                                    alt={icon.displayName}
                                                                    className="w-full h-full object-contain"
                                                                />
                                                            </motion.button>
                                                        );
                                                    })}
                                                    {/* CDN results */}
                                                    {cdnMatches.map(name => {
                                                        const iconValue = `cdn:${name}`;
                                                        const isSelected = value === iconValue;
                                                        const displayName = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                                                        return (
                                                            <motion.button
                                                                key={`cdn-${name}`}
                                                                type="button"
                                                                onClick={() => handleIconSelect(iconValue)}
                                                                whileHover={{ scale: 1.05 }}
                                                                whileTap={{ scale: 0.95 }}
                                                                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                                                className={`aspect-square p-2 rounded-lg transition-colors ${isSelected
                                                                    ? 'bg-accent ring-2 ring-accent/50'
                                                                    : 'bg-theme-tertiary hover:bg-theme-hover'
                                                                    }`}
                                                                title={`${displayName} (Community)`}
                                                            >
                                                                <img
                                                                    src={`https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/${name}.png`}
                                                                    alt={displayName}
                                                                    className="w-full h-full object-contain"
                                                                    loading="lazy"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                                    }}
                                                                />
                                                            </motion.button>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    /* Default view — System Icons + Your Icons sections */
                                    <>
                                        {/* System Icons Section */}
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => setSystemCollapsed(!systemCollapsed)}
                                                className="flex items-center gap-2 w-full text-left"
                                            >
                                                <ChevronDown
                                                    size={14}
                                                    className={`text-theme-secondary transition-transform ${systemCollapsed ? '-rotate-90' : ''}`}
                                                />
                                                <h4 className="text-sm font-medium text-theme-primary">System Icons</h4>
                                                <span className="text-xs text-theme-tertiary">({systemIcons.length})</span>
                                            </button>
                                            {!systemCollapsed && (
                                                <div className="grid grid-cols-4 gap-2 mt-2">
                                                    {systemIcons.map(icon => {
                                                        const iconValue = `system:${icon.name}`;
                                                        const isSelected = value === iconValue;
                                                        return (
                                                            <motion.button
                                                                key={icon.name}
                                                                type="button"
                                                                onClick={() => handleIconSelect(iconValue)}
                                                                whileHover={{ scale: 1.05 }}
                                                                whileTap={{ scale: 0.95 }}
                                                                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                                                className={`aspect-square p-2 rounded-lg transition-colors ${isSelected
                                                                    ? 'bg-accent ring-2 ring-accent/50'
                                                                    : 'bg-theme-tertiary hover:bg-theme-hover'
                                                                    }`}
                                                                title={icon.displayName}
                                                            >
                                                                <img
                                                                    src={`/api/icons/system/${icon.name}/file`}
                                                                    alt={icon.displayName}
                                                                    className="w-full h-full object-contain"
                                                                />
                                                            </motion.button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Your Icons Section */}
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => setUserCollapsed(!userCollapsed)}
                                                className="flex items-center gap-2 w-full text-left"
                                            >
                                                <ChevronDown
                                                    size={14}
                                                    className={`text-theme-secondary transition-transform ${userCollapsed ? '-rotate-90' : ''}`}
                                                />
                                                <h4 className="text-sm font-medium text-theme-primary">Your Icons</h4>
                                                <span className="text-xs text-theme-tertiary">({uploadedIcons.length})</span>
                                            </button>
                                            {!userCollapsed && (
                                                <>
                                                    {loadingIcons ? (
                                                        <div className="text-center py-4 text-theme-secondary">
                                                            Loading...
                                                        </div>
                                                    ) : uploadedIcons.length > 0 ? (
                                                        <div className="grid grid-cols-4 gap-2 mt-2">
                                                            {uploadedIcons.map((icon) => {
                                                                const isSelected = value === `custom:${icon.id}`;
                                                                return (
                                                                    <div key={icon.id} className="relative group">
                                                                        <motion.button
                                                                            type="button"
                                                                            onClick={() => handleIconSelect(`custom:${icon.id}`)}
                                                                            whileHover={{ scale: 1.05 }}
                                                                            whileTap={{ scale: 0.95 }}
                                                                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                                                            className={`w-full aspect-square p-2 rounded-lg transition-colors ${isSelected
                                                                                ? 'bg-accent ring-2 ring-accent/50'
                                                                                : 'bg-theme-tertiary hover:bg-theme-hover'
                                                                                }`}
                                                                            title={icon.originalName}
                                                                        >
                                                                            <img
                                                                                src={`/api/custom-icons/${icon.id}/file`}
                                                                                alt={icon.originalName}
                                                                                className="w-full h-full object-contain"
                                                                            />
                                                                        </motion.button>
                                                                        <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <ConfirmButton
                                                                                onConfirm={() => handleDeleteIcon(icon.id)}
                                                                                confirmMode="iconOnly"
                                                                                size="sm"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-4 text-theme-secondary mt-2">
                                                            <p className="text-xs">Upload custom icons above</p>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </Popover.Content>
        </Popover>
    );
};

export default IconPicker;
