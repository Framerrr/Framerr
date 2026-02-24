/**
 * TemplateBuilderStep1 - Setup form for template metadata
 * 
 * Fields:
 * - Template Name (required)
 * - Category (required, with admin creation)
 * - Description (optional)
 * - Default for New Users (admin only)
 */

import React, { useState, useEffect } from 'react';
import { templatesApi } from '../../../api/endpoints';
import type { TemplateData } from './TemplateBuilder';
import { Checkbox, ActionSelect, ConfirmButton } from '@/shared/ui';
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



const TemplateBuilderStep1: React.FC<Step1Props> = ({
    data,
    onChange,
    isAdmin = false,
    onReady,
}) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [creatingCategory, setCreatingCategory] = useState(false);

    // Derived: display text for trigger
    const selectedCategory = categories.find(c => c.id === data.categoryId);

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
    const handleCreateCategory = async (name: string) => {
        setCreatingCategory(true);
        try {
            const response = await templatesApi.createCategory(name);
            const newCategory = response.category;
            setCategories(prev => [...prev, newCategory]);
            onChange({ categoryId: newCategory.id });
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

    // Determine if an option can be deleted
    const canDeleteOption = (catId: string): boolean => {
        return isAdmin && categories.some(c => c.id === catId);
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
                ) : (
                    <ActionSelect closeOnScroll={false}>
                        <ActionSelect.Trigger>
                            <button
                                type="button"
                                className="
                                    w-full inline-flex items-center justify-between gap-2
                                    px-3 py-2
                                    bg-theme-tertiary border border-theme rounded-lg
                                    text-sm text-theme-primary
                                    hover:bg-theme-hover transition-colors
                                    focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-theme-primary
                                "
                            >
                                <span>{selectedCategory?.name || 'None'}</span>
                            </button>
                        </ActionSelect.Trigger>
                        <ActionSelect.Content>
                            {isAdmin && (
                                <ActionSelect.AddInput
                                    placeholder="New category name"
                                    onAdd={handleCreateCategory}
                                    loading={creatingCategory}
                                />
                            )}
                            <ActionSelect.Items>
                                {/* None option */}
                                <ActionSelect.Item
                                    selected={!data.categoryId}
                                    onClick={() => onChange({ categoryId: null })}
                                >
                                    None
                                </ActionSelect.Item>
                                {/* Category options */}
                                {categories.map((cat) => (
                                    <ActionSelect.Item
                                        key={cat.id}
                                        selected={data.categoryId === cat.id}
                                        onClick={() => onChange({ categoryId: cat.id })}
                                        action={canDeleteOption(cat.id) ? (
                                            <ConfirmButton
                                                onConfirm={() => handleDeleteCategory(cat.id)}
                                                label=""
                                                size="sm"
                                                confirmMode="iconOnly"
                                                showTriggerIcon={true}
                                            />
                                        ) : undefined}
                                    >
                                        {cat.name}
                                    </ActionSelect.Item>
                                ))}
                            </ActionSelect.Items>
                            {categories.length === 0 && (
                                <ActionSelect.Empty>
                                    No categories yet
                                </ActionSelect.Empty>
                            )}
                        </ActionSelect.Content>
                    </ActionSelect>
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
