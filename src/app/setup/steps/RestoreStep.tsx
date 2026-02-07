import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileArchive, CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { authApi } from '../../../api/endpoints';

interface RestoreStepProps {
    goBack: () => void;
}

const RestoreStep: React.FC<RestoreStepProps> = ({ goBack }) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        setError(null);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            if (!droppedFile.name.endsWith('.zip')) {
                setError('Please upload a .zip file');
                return;
            }
            setFile(droppedFile);
        }
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.name.endsWith('.zip')) {
                setError('Please upload a .zip file');
                return;
            }
            setFile(selectedFile);
        }
    }, []);

    const handleRestore = useCallback(async () => {
        if (!file) return;

        setUploading(true);
        setError(null);
        setProgress(0);

        const formData = new FormData();
        formData.append('backup', file);

        try {
            await authApi.setupRestore(formData, (percent) => {
                setProgress(percent);
            });

            setSuccess(true);

            // Set flag so Login page shows success toast for admin
            localStorage.setItem('restoredFromBackup', 'true');

            // Hard redirect to login - forces AuthContext to re-check setup status
            // With hot-swap, redirect can be fast
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
        } catch (err) {
            const error = err as { response?: { data?: { error?: string } } };
            setError(error.response?.data?.error || 'Failed to restore backup');
            setUploading(false);
        }
    }, [file]);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="glass-subtle p-8 rounded-2xl border border-theme text-center">
            {/* Title */}
            <motion.h2
                className="text-3xl font-bold text-theme-primary mb-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                Restore from Backup
            </motion.h2>

            {/* Subtitle */}
            <motion.p
                className="text-theme-secondary mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                Upload a Framerr backup file to restore your dashboard
            </motion.p>

            {/* Success State */}
            {success ? (
                <motion.div
                    className="max-w-sm mx-auto p-8 rounded-xl glass-subtle border border-success/30"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <CheckCircle size={48} className="text-success mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-theme-primary mb-2">Restore Complete!</h3>
                    <p className="text-theme-secondary">Redirecting to login...</p>
                </motion.div>
            ) : (
                <>
                    {/* Upload Zone - no hover effect */}
                    <motion.div
                        className={`max-w-sm mx-auto rounded-xl border-2 border-dashed transition-all duration-200 ${dragOver
                            ? 'border-accent bg-accent/10'
                            : file
                                ? 'border-accent/50 bg-accent/5'
                                : 'border-theme-light'
                            }`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                    >
                        <label className="block p-8 cursor-pointer">
                            <input
                                type="file"
                                accept=".zip"
                                onChange={handleFileSelect}
                                className="hidden"
                                disabled={uploading}
                            />

                            {file ? (
                                <div className="text-center">
                                    <FileArchive size={40} className="text-accent mx-auto mb-3" />
                                    <p className="font-medium text-theme-primary">{file.name}</p>
                                    <p className="text-sm text-theme-secondary">{formatFileSize(file.size)}</p>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <Upload size={40} className="text-theme-tertiary mx-auto mb-3" />
                                    <p className="text-theme-primary font-medium">Drop backup file here</p>
                                    <p className="text-sm text-theme-secondary">or click to browse</p>
                                </div>
                            )}
                        </label>
                    </motion.div>

                    {/* Error Message */}
                    {error && (
                        <motion.div
                            className="max-w-sm mx-auto mt-4 p-3 rounded-lg bg-error/10 border border-error/30 flex items-center gap-2"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <XCircle size={18} className="text-error flex-shrink-0" />
                            <span className="text-sm text-error">{error}</span>
                        </motion.div>
                    )}

                    {/* Progress Bar */}
                    {uploading && (
                        <motion.div
                            className="max-w-sm mx-auto mt-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <div className="h-2 bg-theme-tertiary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-accent transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-sm text-theme-secondary mt-2">
                                {progress < 100 ? 'Uploading...' : 'Processing...'}
                            </p>
                        </motion.div>
                    )}

                    {/* Action Buttons */}
                    <motion.div
                        className="flex items-center justify-center gap-4 mt-8"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <button
                            onClick={goBack}
                            disabled={uploading}
                            className="px-6 py-3 rounded-xl border border-theme text-theme-secondary hover:text-theme-primary hover:border-theme-primary transition-colors disabled:opacity-50"
                        >
                            <ArrowLeft size={18} className="inline mr-2" />
                            Back
                        </button>

                        <button
                            onClick={handleRestore}
                            disabled={!file || uploading}
                            className="px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Restoring...
                                </>
                            ) : (
                                'Restore Backup'
                            )}
                        </button>
                    </motion.div>
                </>
            )}
        </div>
    );
};

export default RestoreStep;
