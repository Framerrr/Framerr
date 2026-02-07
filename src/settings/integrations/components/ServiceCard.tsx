import React from 'react';
import { LucideIcon, ChevronRight } from 'lucide-react';

interface ServiceCardProps {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    isConfigured: boolean;
    onClick: () => void;
}

/**
 * ServiceCard - Horizontal card matching Widget Gallery pattern
 * Icon in accent box left, title+description middle, configured badge right
 */
const ServiceCard: React.FC<ServiceCardProps> = ({
    name,
    description,
    icon: Icon,
    isConfigured,
    onClick
}) => {
    return (
        <button
            onClick={onClick}
            className="
                w-full glass-subtle rounded-xl p-4 border border-theme
                hover:bg-theme-hover/50 hover:border-accent/50
                transition-all duration-200
                flex items-center gap-4
                cursor-pointer group card-glow
            "
        >
            {/* Icon in accent box */}
            <div className="
                p-3 bg-accent/20 rounded-lg flex-shrink-0
                group-hover:bg-accent/30 transition-colors
            ">
                <Icon size={24} className="text-accent" />
            </div>

            {/* Title + Description */}
            <div className="flex-1 min-w-0 text-left">
                <h4 className="font-semibold text-theme-primary mb-0.5">{name}</h4>
                <p className="text-sm text-theme-secondary truncate">{description}</p>
            </div>

            {/* Right side: Badge + Chevron */}
            <div className="flex items-center gap-3 flex-shrink-0">
                {isConfigured && (
                    <span className="
                        px-2 py-1 rounded-full
                        text-[10px] font-semibold uppercase tracking-wide
                        bg-success/20 text-success border border-success/30
                    ">
                        Configured
                    </span>
                )}
                <ChevronRight
                    size={20}
                    className="text-theme-tertiary group-hover:text-accent transition-colors"
                />
            </div>
        </button>
    );
};

export default ServiceCard;
