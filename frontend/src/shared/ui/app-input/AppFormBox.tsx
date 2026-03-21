import React from 'react';

export interface AppFormBoxProps {
    children: React.ReactNode;
    className?: string;
    isFocused?: boolean;
    disabled?: boolean;
    hasError?: boolean;
    as?: any; // To support 'div', 'button', styled components, etc.
    [key: string]: any;
}

/**
 * A shared container for form elements (inputs, selects, etc.)
 * that provides standardized border, rounding, padding, and background.
 */
export const AppFormBox: React.FC<AppFormBoxProps> = ({
    children,
    className = '',
    isFocused = false,
    disabled = false,
    hasError = false,
    as: Component = 'div',
    ...props
}) => {
    const baseClasses = `
        w-full flex items-center gap-2 min-w-0
        px-3 py-1
        bg-surface-950/20
        border border-[var(--border-base)]
        rounded-lg
        transition-all
        duration-200
        focus-within:border-brand
        focus-within:ring-1
        focus-within:ring-brand/20
        ${isFocused ? 'border-brand ring-1 ring-brand/20' : ''}
        ${hasError ? 'border-red-500 ring-1 ring-red-500/20' : ''}
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        text-xs font-normal
    `.replace(/\s+/g, ' ').trim();

    return (
        <Component
            className={`${baseClasses} ${className}`}
            disabled={disabled}
            {...props}
        >
            {children}
        </Component>
    );
};
