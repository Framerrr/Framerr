import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MenuContentShellProps {
    /** Which view is currently active */
    activeView: 'tabs' | 'notifications';
    /** Header content for the tabs view */
    tabsHeader: React.ReactNode;
    /** Header content for the notifications view */
    notificationsHeader: React.ReactNode;
    /** Body content for the tabs view */
    tabsBody: React.ReactNode;
    /** Body content for the notifications view */
    notificationsBody: React.ReactNode;
    /** Footer content (shared between views) */
    footer: React.ReactNode;
    /** Whether the menu is open (controls visibility) */
    isOpen: boolean;
    /** Ref for pull-to-close gesture target */
    contentRef?: React.RefObject<HTMLDivElement | null>;
}

// Rolodex body variants — both views spin in the same vertical direction
// direction: 1 = spin upward (tabs→notifications), -1 = spin downward (notifications→tabs)
const bodyVariants = {
    enter: (direction: number) => ({
        y: `${direction * 100}%`,  // enters from below (1) or above (-1)
        opacity: 0,
    }),
    center: {
        y: 0,
        opacity: 1,
    },
    exit: (direction: number) => ({
        y: `${direction * -100}%`, // exits upward (1) or downward (-1)
        opacity: 0,
    }),
};

const springTransition = {
    type: 'spring' as const,
    stiffness: 300,
    damping: 32,
};

/**
 * MenuContentShell - Shared layout structure for the mobile menu.
 *
 * Provides consistent Header | Body | Footer layout for both
 * the tabs view and notification center view.
 *
 * Rolodex animation: both views spin in the SAME direction simultaneously.
 * Header slides horizontally, body transitions vertically.
 */
const MenuContentShell = ({
    activeView,
    tabsHeader,
    notificationsHeader,
    tabsBody,
    notificationsBody,
    footer,
    isOpen,
    contentRef,
}: MenuContentShellProps): React.JSX.Element => {
    // Circular spin: always upward (up and out, up and in)
    const direction = 1;

    return (
        <motion.div
            ref={contentRef}
            className="flex flex-col"
            initial={false}
            animate={{ opacity: isOpen ? 1 : 0 }}
            transition={{
                type: 'spring',
                stiffness: 350,
                damping: 35,
                mass: 0.7,
            }}
            style={{
                flex: 1,
                minHeight: 0,
                pointerEvents: isOpen ? 'auto' : 'none',
                overflow: 'hidden',
                touchAction: 'pan-y',
            }}
        >
            <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
                {/* HEADER — vertical rolodex (same direction as body) */}
                <div className="flex-shrink-0 overflow-hidden relative">
                    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                        <motion.div
                            key={activeView + '-header'}
                            custom={direction}
                            variants={bodyVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={springTransition}
                        >
                            {activeView === 'notifications' ? notificationsHeader : tabsHeader}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* BODY — vertical rolodex (both spin same direction) */}
                <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
                    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                        <motion.div
                            key={activeView + '-body'}
                            custom={direction}
                            variants={bodyVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={springTransition}
                            className="h-full"
                        >
                            {activeView === 'notifications' ? notificationsBody : tabsBody}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* FOOTER — shared, no transition */}
                <div className="flex-shrink-0">
                    {footer}
                </div>
            </div>
        </motion.div>
    );
};

export default MenuContentShell;
