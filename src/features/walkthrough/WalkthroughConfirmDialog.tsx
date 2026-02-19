/**
 * WalkthroughConfirmDialog
 * 
 * Confirmation dialog shown when user attempts a blocked action
 * (e.g., closing the modal during a walkthrough step).
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../shared/ui/Button';

interface WalkthroughConfirmDialogProps {
    isVisible: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
};

const TRANSITION = {
    duration: 0.22,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

const WalkthroughConfirmDialog: React.FC<WalkthroughConfirmDialogProps> = ({
    isVisible,
    onCancel,
    onConfirm,
}) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <div className="walkthrough-centered-card" style={{ zIndex: 10001 }}>
                    <motion.div
                        key="end-confirmation"
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        transition={TRANSITION}
                    >
                        <div className="walkthrough-card">
                            <h3 className="walkthrough-card-title">End Walkthrough?</h3>
                            <p className="walkthrough-card-message">
                                You can always restart the tour from Settings.
                            </p>
                            <div className="walkthrough-card-buttons" style={{ justifyContent: 'flex-end' }}>
                                <Button variant="outline" size="sm" onClick={onCancel}>
                                    Cancel
                                </Button>
                                <Button variant="primary" size="sm" onClick={onConfirm}>
                                    End Tour
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default WalkthroughConfirmDialog;
