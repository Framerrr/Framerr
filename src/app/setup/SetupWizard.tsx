import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi, systemApi, themeApi, plexApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

// Step components
import WelcomeStep from './steps/WelcomeStep';
import ChoiceStep from './steps/ChoiceStep';
import RestoreStep from './steps/RestoreStep';
import ThemeStep from './steps/ThemeStep';
import CustomizeStep from './steps/CustomizeStep';
import AccountStep from './steps/AccountStep';
import AuthStep from './steps/AuthStep';
import CompleteStep from './steps/CompleteStep';
import ThemeRipple from './ThemeRipple';

// Types
export interface WizardData {
    // Theme
    theme: string;

    // Customization
    appName: string;
    flattenUI: boolean;

    // Account
    username: string;
    password: string;
    displayName: string;

    // Auth
    plexSSOEnabled: boolean;
    autoCreateUsers: boolean;
}

interface RippleState {
    active: boolean;
    x: number;
    y: number;
    color: string;
}

const STEPS = ['welcome', 'choice', 'theme', 'account', 'customize', 'auth', 'complete'] as const;
type StepName = typeof STEPS[number];

// Animation variants for step transitions
const stepVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? '100%' : '-100%',
        opacity: 0
    }),
    center: {
        x: 0,
        opacity: 1
    },
    exit: (direction: number) => ({
        x: direction > 0 ? '-100%' : '100%',
        opacity: 0
    })
};

const stepTransition = {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30
};

const SetupWizard: React.FC = () => {
    const navigate = useNavigate();
    const { login, checkSetupStatus } = useAuth();
    const { changeTheme } = useTheme();

    // Current step index
    const [currentStep, setCurrentStep] = useState(0);
    const [direction, setDirection] = useState(0);
    // Restore flow (alternative path from choice step)
    const [isRestoreFlow, setIsRestoreFlow] = useState(false);

    // Wizard data
    const [data, setData] = useState<WizardData>({
        theme: 'dark-pro',
        appName: 'Framerr',
        flattenUI: false,
        username: '',
        password: '',
        displayName: '',
        plexSSOEnabled: false,
        autoCreateUsers: false
    });

    // Theme ripple animation state with key for rapid selections
    const [ripple, setRipple] = useState<RippleState & { key: number }>({
        active: false,
        x: 0,
        y: 0,
        color: '',
        key: 0
    });

    // Loading and error states
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Update wizard data
    const updateData = useCallback((updates: Partial<WizardData>) => {
        setData(prev => ({ ...prev, ...updates }));
    }, []);

    // Trigger theme ripple effect
    const triggerRipple = useCallback((x: number, y: number, color: string) => {
        // Increment key to force re-render even on rapid selections
        setRipple(prev => ({ active: true, x, y, color, key: prev.key + 1 }));

        // Clear ripple after animation
        setTimeout(() => {
            setRipple(prev => ({ ...prev, active: false }));
        }, 600);
    }, []);

    // Navigation functions
    const goNext = useCallback(() => {
        if (currentStep < STEPS.length - 1) {
            setDirection(1);
            setCurrentStep(prev => prev + 1);
            setError(null);
        }
    }, [currentStep]);

    const goBack = useCallback(() => {
        if (currentStep > 0) {
            setDirection(-1);
            setCurrentStep(prev => prev - 1);
            setError(null);
        }
    }, [currentStep]);

    const skip = useCallback(() => {
        goNext();
    }, [goNext]);

    // Create admin account (Step 3)
    const createAccount = useCallback(async (): Promise<boolean> => {
        setLoading(true);
        setError(null);

        try {
            // Create admin account
            await authApi.createAdminAccount({
                username: data.username,
                password: data.password,
                confirmPassword: data.password,
                displayName: data.displayName || data.username
            });

            // Auto-login (but don't check setup status - that would trigger redirect)
            const loginResult = await login(data.username, data.password, true);

            if (!loginResult.success) {
                setError(loginResult.error || 'Login failed after account creation');
                setLoading(false);
                return false;
            }

            // Don't call checkSetupStatus() here - it would set needsSetup=false
            // and trigger AuthContext redirect to /login. 
            // Let the wizard control its own flow.

            setLoading(false);
            return true;
        } catch (err) {
            const error = err as { response?: { data?: { error?: string } } };
            setError(error.response?.data?.error || 'Failed to create account');
            setLoading(false);
            return false;
        }
    }, [data.username, data.password, data.displayName, login]);

    // Save customization settings (Step 4)
    const saveCustomization = useCallback(async (): Promise<boolean> => {
        setLoading(true);
        setError(null);

        try {
            // Save app name (system config)
            await systemApi.updateSystemConfig({
                appName: data.appName
            });

            // Save theme - call API directly (guaranteed persistence) AND update ThemeContext (UI sync)
            // We call API directly because changeTheme's isAuthenticated check may be stale during setup
            await themeApi.saveTheme({
                preset: data.theme,
                mode: 'dark'
            });
            // Also update ThemeContext state so UI reflects immediately without reload
            await changeTheme(data.theme);

            // Save flatten UI preference (must use preferences.ui.flattenUI to match CustomizationSettings)
            await systemApi.updateUserConfig({
                preferences: {
                    ui: { flattenUI: data.flattenUI }
                }
            });

            setLoading(false);
            return true;
        } catch (err) {
            const error = err as { response?: { data?: { error?: string } } };
            setError(error.response?.data?.error || 'Failed to save settings');
            setLoading(false);
            return false;
        }
    }, [data.appName, data.theme, data.flattenUI]);

    // Save auth settings (Step 5)
    const saveAuthSettings = useCallback(async (): Promise<boolean> => {
        if (!data.plexSSOEnabled) {
            return true; // Nothing to save
        }

        setLoading(true);
        setError(null);

        try {
            await plexApi.setSSOConfig({
                enabled: data.plexSSOEnabled,
                autoCreateUsers: data.autoCreateUsers
            });

            setLoading(false);
            return true;
        } catch (err) {
            const error = err as { response?: { data?: { error?: string } } };
            setError(error.response?.data?.error || 'Failed to save auth settings');
            setLoading(false);
            return false;
        }
    }, [data.plexSSOEnabled, data.autoCreateUsers]);

    // Complete setup and go to dashboard
    const complete = useCallback(async () => {
        // Update setup status in AuthContext so it knows setup is complete
        // This prevents the redirect back to /setup when we navigate to /
        await checkSetupStatus();
        navigate('/', { replace: true });
    }, [navigate, checkSetupStatus]);

    // Render current step
    const renderStep = () => {
        const stepName = STEPS[currentStep];

        const commonProps = {
            data,
            updateData,
            loading,
            error,
            goNext,
            goBack,
            skip
        };

        // If in restore flow, show restore step
        if (isRestoreFlow) {
            return <RestoreStep goBack={() => {
                setIsRestoreFlow(false);
                setCurrentStep(1); // Go back to choice step
            }} />;
        }

        switch (stepName) {
            case 'welcome':
                return <WelcomeStep {...commonProps} />;
            case 'choice':
                return <ChoiceStep
                    {...commonProps}
                    onRestoreChoice={() => setIsRestoreFlow(true)}
                />;
            case 'theme':
                return <ThemeStep {...commonProps} triggerRipple={triggerRipple} />;
            case 'account':
                return <AccountStep {...commonProps} createAccount={createAccount} />;
            case 'customize':
                return <CustomizeStep {...commonProps} saveCustomization={saveCustomization} />;
            case 'auth':
                return <AuthStep {...commonProps} saveAuthSettings={saveAuthSettings} />;
            case 'complete':
                return <CompleteStep {...commonProps} complete={complete} />;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-theme-primary p-4 overflow-hidden">
            {/* Theme ripple effect - key forces re-mount on rapid selections */}
            <ThemeRipple key={ripple.key} active={ripple.active} x={ripple.x} y={ripple.y} color={ripple.color} />

            {/* Progress indicator */}
            <div className="fixed top-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {STEPS.map((_, index) => (
                    <motion.div
                        key={index}
                        className={`h-2 rounded-full transition-all duration-300 ${index === currentStep
                            ? 'w-8 bg-accent'
                            : index < currentStep
                                ? 'w-2 bg-accent/50'
                                : 'w-2 bg-theme-tertiary'
                            }`}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                    />
                ))}
            </div>

            {/* Step content with animations */}
            <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                    key={currentStep}
                    custom={direction}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={stepTransition}
                    className="w-full max-w-lg"
                >
                    {renderStep()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default SetupWizard;
