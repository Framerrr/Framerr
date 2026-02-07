/**
 * Favicon Section Component
 * 
 * Allows uploading custom favicon packages from RealFaviconGenerator.net
 */

import React, { useState, useEffect, ChangeEvent } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Upload, AlertCircle, CheckCircle, Link as LinkIcon, Loader } from 'lucide-react';
import { configApi } from '../../../api/endpoints';
import logger from '../../../utils/logger';
import { Button, ConfirmButton, Switch } from '../../../shared/ui';
import { SettingsPage, SettingsSection, SettingsItem, SettingsAlert } from '../../../shared/ui/settings';
import { Textarea } from '../../../components/common/Input';

interface LocalFaviconConfig {
    enabled: boolean;
    htmlSnippet?: string;
    uploadedAt?: string;
    uploadedBy?: string;
}

interface Message {
    type: 'success' | 'error';
    text: string;
}

export function FaviconSection() {
    const [faviconFile, setFaviconFile] = useState<File | null>(null);
    const [htmlSnippet, setHtmlSnippet] = useState<string>('');
    const [currentFavicon, setCurrentFavicon] = useState<LocalFaviconConfig | null>(null);
    const [faviconEnabled, setFaviconEnabled] = useState<boolean>(true);
    const [uploading, setUploading] = useState<boolean>(false);
    const [message, setMessage] = useState<Message | null>(null);

    useEffect(() => {
        fetchCurrentFavicon();
    }, []);

    const fetchCurrentFavicon = async (): Promise<void> => {
        try {
            const response = await configApi.getFavicon();
            setCurrentFavicon(response as LocalFaviconConfig);
            setFaviconEnabled(response?.enabled !== false);

            // Populate HTML snippet field if exists
            if (response?.htmlSnippet) {
                setHtmlSnippet(response.htmlSnippet);
            }
        } catch (error) {
            logger.error('Failed to fetch favicon config:', error);
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
                setMessage({ type: 'error', text: 'Please select a ZIP file' });
                return;
            }
            setFaviconFile(file);
            setMessage(null);
        }
    };

    const handleUpload = async (): Promise<void> => {
        if (!faviconFile) {
            setMessage({ type: 'error', text: 'Please select a favicon ZIP file' });
            return;
        }

        if (!htmlSnippet.trim()) {
            setMessage({ type: 'error', text: 'Please paste the HTML snippet from RealFaviconGenerator' });
            return;
        }

        setUploading(true);
        setMessage(null);

        try {
            const formData = new FormData();
            formData.append('faviconZip', faviconFile);
            formData.append('htmlSnippet', htmlSnippet);

            await configApi.uploadFavicon(formData);

            setMessage({ type: 'success', text: 'Favicon uploaded successfully! Refresh the page to see changes.' });
            setFaviconFile(null);
            setHtmlSnippet('');
            fetchCurrentFavicon();

            // Reset file input
            const fileInput = document.getElementById('faviconFileInput') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

            // Trigger favicon reload
            window.dispatchEvent(new Event('faviconUpdated'));
        } catch (error) {
            const err = error as Error & { response?: { data?: { error?: string } } };
            setMessage({
                type: 'error',
                text: err.response?.data?.error || 'Failed to upload favicon'
            });
        } finally {
            setUploading(false);
        }
    };

    const handleToggleFavicon = async (): Promise<void> => {
        try {
            const newState = !faviconEnabled;
            await configApi.toggleFavicon(newState);
            setFaviconEnabled(newState);
            setMessage({
                type: 'success',
                text: `Custom favicon ${newState ? 'enabled' : 'disabled'}. Refresh to see changes.`
            });

            // Trigger favicon reload
            window.dispatchEvent(new Event('faviconUpdated'));
        } catch (error) {
            const err = error as Error & { response?: { data?: { error?: string } } };
            setMessage({
                type: 'error',
                text: err.response?.data?.error || 'Failed to toggle favicon'
            });
        }
    };

    const handleConfirmReset = async (): Promise<void> => {
        setMessage(null);

        try {
            await configApi.deleteFavicon();
            setMessage({ type: 'success', text: 'Favicon reset to default! Refresh the page to see changes.' });
            setCurrentFavicon(null);
            setHtmlSnippet('');

            // Trigger favicon reload
            window.dispatchEvent(new Event('faviconUpdated'));
        } catch (error) {
            const err = error as Error & { response?: { data?: { error?: string } } };
            setMessage({
                type: 'error',
                text: err.response?.data?.error || 'Failed to reset favicon'
            });
        }
    };

    return (
        <SettingsPage
            title="Favicon"
            description="Upload a custom favicon package from RealFaviconGenerator.net"
        >
            {/* Current Status - Only shows when custom favicon exists */}
            <AnimatePresence>
                {currentFavicon?.htmlSnippet && (
                    <SettingsSection
                        key="favicon-status"
                        title={faviconEnabled ? 'Custom Favicon Active' : 'Using Default Framerr Favicon'}
                        icon={faviconEnabled ? CheckCircle : AlertCircle}
                        noAnimation
                    >
                        {/* Toggle Switch */}
                        <SettingsItem
                            label="Use Custom Favicon"
                            description={faviconEnabled
                                ? 'Custom favicon is currently active'
                                : 'Using default Framerr favicon'}
                            noAnimation
                        >
                            <Switch
                                checked={faviconEnabled}
                                onCheckedChange={handleToggleFavicon}
                            />
                        </SettingsItem>

                        {/* Upload metadata */}
                        {currentFavicon.uploadedAt && (
                            <p className="text-xs text-theme-tertiary mt-3">
                                Uploaded by {currentFavicon.uploadedBy} on {new Date(currentFavicon.uploadedAt).toLocaleString()}
                            </p>
                        )}

                        {/* Delete button with inline confirmation */}
                        <div className="mt-4">
                            <ConfirmButton
                                onConfirm={handleConfirmReset}
                                label="Delete Custom Favicon"
                                confirmMode="text"
                                size="md"
                                textSize="sm"
                                cancelPosition="right"
                            />
                        </div>
                    </SettingsSection>
                )}
            </AnimatePresence>

            {/* Upload Form */}
            <SettingsSection title="Upload Favicon" icon={Upload}>
                {/* Instructions */}
                <div className="flex items-start gap-3">
                    <AlertCircle className="text-accent flex-shrink-0 mt-0.5" size={20} />
                    <div className="text-sm space-y-2">
                        <p className="text-accent font-medium">How to use RealFaviconGenerator.net:</p>
                        <ol className="list-decimal list-inside space-y-1 text-theme-secondary">
                            <li>Go to <a href="https://realfavicongenerator.net" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">realfavicongenerator.net</a></li>
                            <li>Upload your logo/icon image</li>
                            <li>Configure your favicon settings</li>
                            <li>In "Favicon Generator Options", set path to <code className="bg-theme-tertiary px-1.5 py-0.5 rounded text-accent">/favicon</code></li>
                            <li>Click "Generate your Favicons and HTML code"</li>
                            <li>Download the ZIP package and copy the HTML code</li>
                            <li>Upload both below</li>
                        </ol>
                    </div>
                </div>

                {/* File Upload */}
                <div>
                    <label className="block mb-2 font-medium text-theme-secondary text-sm">
                        1. Upload Favicon ZIP Package
                    </label>
                    <div className="relative">
                        <input
                            id="faviconFileInput"
                            type="file"
                            accept=".zip,application/zip,application/x-zip-compressed"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <label
                            htmlFor="faviconFileInput"
                            className="flex items-center justify-center gap-3 w-full px-6 py-8 border-2 border-dashed border-theme rounded-lg cursor-pointer hover:border-accent hover:bg-theme-tertiary/30 transition-colors"
                        >
                            <Upload size={24} className="text-theme-secondary" />
                            <div className="text-center">
                                {faviconFile ? (
                                    <>
                                        <p className="text-theme-primary font-medium">{faviconFile.name}</p>
                                        <p className="text-xs text-theme-secondary mt-1">
                                            {(faviconFile.size / 1024).toFixed(2)} KB
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-theme-secondary">Click to select ZIP file</p>
                                        <p className="text-xs text-theme-tertiary mt-1">or drag and drop</p>
                                    </>
                                )}
                            </div>
                        </label>
                    </div>
                </div>

                {/* HTML Snippet */}
                <div>
                    <label className="block mb-2 font-medium text-theme-secondary text-sm flex items-center gap-2">
                        <span>2. Paste HTML Code from RealFaviconGenerator</span>
                        <LinkIcon size={14} className="text-theme-tertiary" />
                    </label>
                    <Textarea
                        value={htmlSnippet}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setHtmlSnippet(e.target.value)}
                        placeholder='<link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png">
...'
                        className="h-32 font-mono text-sm resize-none"
                    />
                    <p className="text-xs text-theme-tertiary mt-2">
                        Copy the HTML code from Step 3 on RealFaviconGenerator.net
                    </p>
                </div>

                {/* Upload Button */}
                <Button
                    onClick={handleUpload}
                    disabled={uploading || !faviconFile || !htmlSnippet}
                    className="w-full"
                    icon={uploading ? Loader : Upload}
                    size="md"
                    textSize="sm"
                >
                    {uploading ? 'Uploading...' : 'Upload Favicon'}
                </Button>
            </SettingsSection>

            {/* Message Display */}
            {message && (
                <SettingsAlert type={message.type}>
                    {message.text}
                </SettingsAlert>
            )}
        </SettingsPage>
    );
}
