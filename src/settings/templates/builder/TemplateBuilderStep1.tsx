/**
 * TemplateBuilderStep1 - Setup form for template metadata
 * 
 * Fields:
 * - Template Name (required)
 * - Category (required, with admin creation)
 * - Description (optional)
 * - Default for New Users (admin only)
 */

import React, { useState, useEffect, useRef } from 'react';
import { templatesApi } from '../../../api/endpoints';
import { Plus, ChevronDown, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TemplateData } from './TemplateBuilder';
import { Checkbox } from '@/shared/ui';
import { popIn } from '@/shared/ui/animations';
import logger from '../../../utils/logger';

interface Category {
    id: string;
    name: string;
}

interface Step1Props {
    data: TemplateData;
    onChange: (updates: Partial<TemplateData>) => void;
    isAdmin?: boolean;
    onReady?: () => void;
}

// ============================================================================
// CategorySelect - Custom Select with add/delete support
// ============================================================================

interface CategorySelectProps {
    categories: Category[];
    value: string;
    onChange: (value: string) => void;
    onDelete?: (categoryId: string) => void;
    canDelete?: (value: string) => boolean;
    showAddOption?: boolean;
}

const CategorySelect: React.FC<CategorySelectProps> = ({
    categories,
    value,
    onChange,
    onDelete,
    canDelete,
    showAddOption = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Get display text
    const selectedCategory = categories.find(c => c.id === value);
    const displayText = selectedCategory?.name || 'None';

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleSelect = (newValue: string) => {
        onChange(newValue);
        if (newValue !== '__new__') {
            setIsOpen(false);
        }
    };

    const handleDelete = (e: React.MouseEvent, categoryId: string) => {
        e.stopPropagation();
        onDelete?.(categoryId);
    };

    return (
        <div className="relative">
            {/* Trigger */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="
                    w-full inline-flex items-center justify-between gap-2
                    px-3 py-2
                    bg-theme-tertiary border border-theme rounded-lg
                    text-sm text-theme-primary
                    hover:bg-theme-hover transition-colors
                    focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-theme-primary
                "
            >
                <span>{displayText}</span>
                <ChevronDown size={16} className={`text-theme-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={dropdownRef}
                        variants={popIn}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="
                            absolute z-[150] mt-1 w-full
                            bg-theme-secondary border border-theme rounded-lg
                            shadow-xl py-1 overflow-hidden
                        "
                    >
                        {/* None option */}
                        <button
                            type="button"
                            onClick={() => handleSelect('')}
                            className={`
                                w-full px-3 py-2 text-left text-sm transition-colors
                                ${value === '' ? 'bg-accent/10 text-accent' : 'text-theme-primary hover:bg-theme-hover'}
                            `}
                        >
                            None
                        </button>

                        {/* Category options */}
                        {categories.map((cat) => (
                            <div
                                key={cat.id}
                                className={`
                                    flex items-center justify-between px-3 py-2 transition-colors
                                    ${value === cat.id ? 'bg-accent/10' : 'hover:bg-theme-hover'}
                                `}
                            >
                                <button
                                    type="button"
                                    onClick={() => handleSelect(cat.id)}
                                    className={`flex-1 text-left text-sm ${value === cat.id ? 'text-accent' : 'text-theme-primary'}`}
                                >
                                    {cat.name}
                                </button>
                                {canDelete?.(cat.id) && (
                                    <button
                                        type="button"
                                        onClick={(e) => handleDelete(e, cat.id)}
                                        className="p-1 text-theme-tertiary hover:text-error hover:bg-error/10 rounded transition-colors"
                                        title="Delete category"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        ))}

                        {/* Add new option */}
                        {showAddOption && (
                            <button
                                type="button"
                                onClick={() => handleSelect('__new__')}
                                className="w-full px-3 py-2 text-left text-sm text-accent hover:bg-theme-hover transition-colors border-t border-theme"
                            >
                                + New Category...
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const TemplateBuilderStep1: React.FC<Step1Props> = ({
    data,
    onChange,
    isAdmin = false,
    onReady,
}) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [creatingCategory, setCreatingCategory] = useState(false);

    // Load categories
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const response = await templatesApi.getCategories();
                setCategories(response.categories || []);
            } catch (error) {
                logger.error('Failed to load categories:', { error });
            } finally {
                setLoading(false);
            }
        };
        loadCategories();
    }, []);

    // Signal ready when categories are loaded
    useEffect(() => {
        if (!loading) {
            onReady?.();
        }
    }, [loading, onReady]);

    // Create new category
    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return;

        setCreatingCategory(true);
        try {
            const response = await templatesApi.createCategory(newCategoryName.trim());
            const newCategory = response.category;
            setCategories(prev => [...prev, newCategory]);
            onChange({ categoryId: newCategory.id });
            setNewCategoryName('');
            setIsCreatingCategory(false);
        } catch (error) {
            logger.error('Failed to create category:', { error });
        } finally {
            setCreatingCategory(false);
        }
    };

    // Delete category
    const handleDeleteCategory = async (categoryId: string) => {
        try {
            await templatesApi.deleteCategory(categoryId);
            setCategories(prev => prev.filter(c => c.id !== categoryId));
            // If the deleted category was selected, clear selection
            if (data.categoryId === categoryId) {
                onChange({ categoryId: null });
            }
        } catch (error) {
            logger.error('Failed to delete category:', { error });
        }
    };

    // Determine if an option can be deleted (only actual categories, not "None" or "__new__")
    const canDeleteOption = (value: string): boolean => {
        return isAdmin && value !== '' && value !== '__new__' && categories.some(c => c.id === value);
    };

    return (
        <div className="space-y-6 max-w-lg mx-auto">
            {/* Template Name */}
            <div>
                <label className="block text-sm font-medium text-theme-primary mb-2">
                    Template Name <span className="text-error">*</span>
                </label>
                <input
                    type="text"
                    value={data.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                    placeholder="My Dashboard Template"
                    className="w-full px-4 py-3 rounded-lg bg-theme-primary border border-theme
                               text-theme-primary placeholder:text-theme-tertiary
                               focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                               transition-colors"
                    autoFocus
                />
            </div>

            {/* Category */}
            <div>
                <label className="block text-sm font-medium text-theme-primary mb-2">
                    Category <span className="text-error">*</span>
                </label>

                {loading ? (
                    <div className="w-full px-4 py-3 rounded-lg bg-theme-primary border border-theme text-theme-tertiary">
                        Loading categories...
                    </div>
                ) : isCreatingCategory ? (
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="New category name"
                            className="flex-1 px-4 py-3 rounded-lg bg-theme-primary border border-theme
                                       text-theme-primary placeholder:text-theme-tertiary
                                       focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateCategory();
                                if (e.key === 'Escape') setIsCreatingCategory(false);
                            }}
                        />
                        <button
                            onClick={handleCreateCategory}
                            disabled={!newCategoryName.trim() || creatingCategory}
                            className="px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90 
                                       disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                        >
                            {creatingCategory ? '...' : 'Add'}
                        </button>
                        <button
                            onClick={() => setIsCreatingCategory(false)}
                            className="px-4 py-2 bg-theme-tertiary text-theme-primary rounded-lg 
                                       hover:bg-theme-hover transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <CategorySelect
                        categories={categories}
                        value={data.categoryId || ''}
                        onChange={(value) => {
                            if (value === '__new__') {
                                setIsCreatingCategory(true);
                            } else {
                                onChange({ categoryId: value || null });
                            }
                        }}
                        onDelete={isAdmin ? handleDeleteCategory : undefined}
                        canDelete={canDeleteOption}
                        showAddOption={isAdmin}
                    />
                )}
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-theme-primary mb-2">
                    Description <span className="text-theme-tertiary">(optional)</span>
                </label>
                <textarea
                    value={data.description}
                    onChange={(e) => onChange({ description: e.target.value })}
                    placeholder="A brief description of what this template is for..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-theme-primary border border-theme
                               text-theme-primary placeholder:text-theme-tertiary
                               focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                               resize-none transition-colors"
                />
            </div>

            {/* Default for New Users - Admin only */}
            {isAdmin && (
                <div className="pt-4 border-t border-theme">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <Checkbox
                            checked={data.isDefault || false}
                            onCheckedChange={(checked) => onChange({ isDefault: checked === true })}
                        />
                        <div className="flex-1">
                            <span className="font-medium text-theme-primary group-hover:text-accent transition-colors">
                                Set as default for new users
                            </span>
                            <p className="text-sm text-theme-tertiary">
                                New users will start with this template applied
                            </p>
                        </div>
                    </label>

                    {/* Additional messaging when default is enabled */}
                    {data.isDefault && (
                        <div className="mt-3 ml-8 p-3 rounded-lg bg-theme-tertiary/30 border border-theme">
                            <p className="text-sm text-theme-secondary">
                                <span className="font-medium text-theme-primary">Integrations will be shared automatically.</span>
                                {' '}When new users are created, any integrations required by this template's widgets will be shared with them.
                            </p>
                            <p className="text-xs text-theme-tertiary mt-1">
                                Sharing can be revoked at any time in Integration Settings.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TemplateBuilderStep1;
