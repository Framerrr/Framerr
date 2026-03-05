import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileArchive, CheckCircle, XCircle, Loader2, ArrowLeft, Lock } from 'lucide-react';
import { authApi } from '../../../api/endpoints';

interface RestoreStepProps {
    goBack: () => void;
}

const ACCEPTED_EXTENSIONS = ['.zip', '.framerr-backup'];

const RestoreStep: React.FC<RestoreStepProps> = ({ goBack }) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);

    // Encrypted backup state
    const [needsPassword, setNeedsPassword] = useState(false);
    const [backupPassword, setBackupPassword] = useState('');
    const [restoreId, setRestoreId] = useState<string | null>(null);
    const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
    const [decrypting, setDecrypting] = useState(false);

    const isValidFile = (filename: string): boolean =>
        ACCEPTED_EXTENSIONS.some(ext => filename.endsWith(ext));

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        setError(null);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            if (!isValidFile(droppedFile.name)) {
                setError('Please upload a .zip or .framerr-backup file');
                return;
            }
            setFile(droppedFile);
            setNeedsPassword(false);
            setRestoreId(null);
            setAttemptsRemaining(null);
        }
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!isValidFile(selectedFile.name)) {
                setError('Please upload a .zip or .framerr-backup file');
                return;
            }
            setFile(selectedFile);
            setNeedsPassword(false);
            setRestoreId(null);
            setAttemptsRemaining(null);
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
            const response = await authApi.setupRestore(formData, (percent) => {
                setProgress(percent);
            });

            // Check if response indicates encrypted backup requiring password
            if (response && 'encrypted' in response && response.encrypted && response.restoreId) {
                setNeedsPassword(true);
                setRestoreId(response.restoreId);
                setUploading(false);
                return;
            }

            // Plain backup — restore complete
            setSuccess(true);
            localStorage.setItem('restoredFromBackup', 'true');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
        } catch (err) {
            const error = err as { response?: { data?: { error?: string } } };
            setError(error.response?.data?.error || 'Failed to restore backup');
            setUploading(false);
        }
    }, [file]);

    const handleDecrypt = useCallback(async () => {
        if (!restoreId || !backupPassword) return;

        setDecrypting(true);
        setError(null);

        try {
            await authApi.setupRestoreDecrypt(backupPassword, restoreId);

            setSuccess(true);
            localStorage.setItem('restoredFromBackup', 'true');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
        } catch (err) {
            const error = err as { response?: { data?: { error?: string; attemptsRemaining?: number }; status?: number } };
            const status = error.response?.status;
            const data = error.response?.data;

            if (status === 401) {
                // Wrong password
                if (data?.attemptsRemaining != null) {
                    setAttemptsRemaining(data.attemptsRemaining);
                    setError(`Incorrect password. ${data.attemptsRemaining} attempt${data.attemptsRemaining !== 1 ? 's' : ''} remaining.`);
                } else {
                    setError(data?.error || 'Incorrect password');
                }
            } else if (status === 410) {
                // Session expired or locked out
                setError('Session expired. Please upload the backup file again.');
                setNeedsPassword(false);
                setRestoreId(null);
                setAttemptsRemaining(null);
                setBackupPassword('');
            } else if (status === 429) {
                // Rate limited
                setError('Too many attempts. Please wait a moment before trying again.');
            } else {
                setError(data?.error || 'Decryption failed');
            }
        } finally {
            setDecrypting(false);
        }
    }, [restoreId, backupPassword]);

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

                /* Password Prompt */
            ) : needsPassword ? (
                <motion.div
                    className="max-w-sm mx-auto space-y-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="p-6 rounded-xl glass-subtle border border-theme">
                        <Lock size={36} className="text-accent mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-theme-primary mb-1">Encrypted Backup</h3>
                        <p className="text-sm text-theme-secondary mb-4">
                            This backup is encrypted. Enter the password that was used when encryption was enabled.
                        </p>

                        <input
                            type="password"
                            value={backupPassword}
                            onChange={(e) => setBackupPassword(e.target.value)}
                            placeholder="Backup encryption password"
                            className="w-full px-3 py-2 rounded-lg bg-theme-tertiary border border-theme text-theme-primary placeholder-theme-tertiary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                            disabled={decrypting}
                            autoFocus
                            autoComplete="off"
                            onKeyDown={(e) => e.key === 'Enter' && backupPassword && handleDecrypt()}
                        />

                        {attemptsRemaining != null && attemptsRemaining <= 3 && (
                            <p className="text-xs text-warning mt-2 text-left">
                                {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining before lockout
                            </p>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 rounded-lg bg-error/10 border border-error/30 flex items-center gap-2">
                            <XCircle size={18} className="text-error flex-shrink-0" />
                            <span className="text-sm text-error text-left">{error}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={() => {
                                setNeedsPassword(false);
                                setRestoreId(null);
                                setBackupPassword('');
                                setError(null);
                                setAttemptsRemaining(null);
                                setFile(null);
                            }}
                            disabled={decrypting}
                            className="px-6 py-3 rounded-xl border border-theme text-theme-secondary hover:text-theme-primary hover:border-theme-primary transition-colors disabled:opacity-50"
                        >
                            <ArrowLeft size={18} className="inline mr-2" />
                            Back
                        </button>

                        <button
                            onClick={handleDecrypt}
                            disabled={!backupPassword || decrypting}
                            className="px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {decrypting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Decrypting...
                                </>
                            ) : (
                                'Decrypt & Restore'
                            )}
                        </button>
                    </div>
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
                                accept=".zip,.framerr-backup"
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
                                    <p className="text-sm text-theme-secondary">or click to browse (.zip or .framerr-backup)</p>
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
