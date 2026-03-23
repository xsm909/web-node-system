import React from 'react';
import { Icon } from '../icon';

interface AppRoundButtonProps {
    icon: string;
    onClick?: (e: React.MouseEvent) => void;
    variant?: 'brand' | 'outline' | 'ghost';
    isLoading?: boolean;
    isDisabled?: boolean;
    title?: string;
    className?: string;
    iconSize?: number;
    size?: 'normal' | 'small';
    type?: 'button' | 'submit' | 'reset';
}

export const AppRoundButton = React.forwardRef<HTMLButtonElement, AppRoundButtonProps>(({
    icon,
    onClick,
    variant = 'brand',
    isLoading = false,
    isDisabled = false,
    title,
    className = '',
    iconSize,
    size = 'normal',
    type = 'button'
}, ref) => {
    const isSmall = size === 'small';
    const computedIconSize = iconSize || (isSmall ? 14 : 20);
    
    const baseStyles = `flex items-center justify-center rounded-full transition-all shadow-lg active:scale-95 shrink-0 ${isSmall ? 'w-7 h-7' : 'w-10 h-10'}`;
    
    const variantStyles = {
        brand: "bg-brand text-white hover:brightness-110 shadow-brand/20",
        outline: "bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]",
        ghost: "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] shadow-none"
    };

    const disabledStyles = "opacity-50 pointer-events-none";

    return (
        <button
            ref={ref}
            type={type}
            onClick={onClick}
            disabled={isDisabled || isLoading}
            className={`${baseStyles} ${variantStyles[variant]} ${isDisabled || isLoading ? disabledStyles : ''} ${className}`}
            title={title}
        >
            <Icon 
                name={isLoading ? 'sync' : icon} 
                size={computedIconSize} 
                className={isLoading ? 'animate-spin' : ''} 
            />
        </button>
    );
});

AppRoundButton.displayName = 'AppRoundButton';
