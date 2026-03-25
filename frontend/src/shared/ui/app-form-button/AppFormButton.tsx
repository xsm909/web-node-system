import React from 'react';
import { Icon } from '../icon';

interface AppFormButtonProps {
    /** Text label to display */
    label?: string;
    /** Icon name from the shared icon library */
    icon?: string;
    /** Primary vs Secondary styling (Ready vs Cancel) */
    isDefault?: boolean;
    /** If true, shows background/border. If false, ghost style. */
    withFrame?: boolean;
    /** Click handler */
    onClick?: (e: React.MouseEvent) => void;
    /** Additional CSS classes */
    className?: string;
    /** Disabled state */
    isDisabled?: boolean;
    /** Loading state with spinner */
    isLoading?: boolean;
    /** Button type */
    type?: 'button' | 'submit';
    /** Tooltip text */
    title?: string;
    /** Icon size override */
    iconSize?: number;
}

/**
 * Standardized button for forms and toolbars.
 * Provides consistent styling for "Ready" (default) and "Cancel" actions.
 */
export const AppFormButton = React.forwardRef<HTMLButtonElement, AppFormButtonProps>(({
    label,
    icon,
    isDefault = false,
    withFrame = true,
    onClick,
    className = '',
    isDisabled = false,
    isLoading = false,
    type = 'button',
    title,
    iconSize = 14
}, ref) => {
    const baseStyles = 'flex items-center justify-center gap-2 rounded-lg transition-all active:scale-95 text-[10px] font-normal leading-none whitespace-nowrap overflow-hidden shrink-0';
    
    // Default (Ready) vs Secondary (Cancel) styles
    const frameStyles = isDefault 
        ? 'bg-brand text-white hover:opacity-90 shadow-sm'
        : 'border border-[var(--border-base)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5';

    // Ghost styles (No frame) - often used for toolbar icons
    const ghostStyles = 'bg-transparent text-brand hover:bg-brand/10';

    const disabledStyles = 'opacity-40 pointer-events-none grayscale';
    
    // Automatic padding: rectangular if label exists, square if not
    const padding = withFrame 
        ? (label ? 'px-4 py-1.5' : 'p-1.5') 
        : 'p-1.5';

    return (
        <button
            ref={ref}
            type={type}
            onClick={onClick}
            disabled={isDisabled || isLoading}
            className={`
                ${baseStyles} 
                ${padding}
                ${withFrame ? frameStyles : ghostStyles}
                ${isDisabled || isLoading ? disabledStyles : ''}
                ${className}
            `}
            title={title}
        >
            {isLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
                icon && <Icon name={icon} size={iconSize} />
            )}
            {label && <span className="pt-px">{label}</span>}
        </button>
    );
});

AppFormButton.displayName = 'AppFormButton';
