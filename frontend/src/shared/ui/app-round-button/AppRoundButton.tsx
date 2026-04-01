import React from 'react';
import { Icon } from '../icon';

interface AppRoundButtonProps {
    icon: string;
    onClick?: (e: React.MouseEvent) => void;
    variant?: 'brand' | 'outline' | 'ghost' | 'danger' | 'success';
    isLoading?: boolean;
    isDisabled?: boolean;
    title?: string;
    className?: string;
    iconSize?: number;
    iconDir?: 'icons' | 'node_icons';
    iconClassName?: string;
    size?: 'normal' | 'small' | 'xs';
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
    iconDir = 'icons',
    iconClassName = '',
    size = 'normal',
    type = 'button'
}, ref) => {
    const isSmall = size === 'small';
    const isXS = size === 'xs';
    const computedIconSize = iconSize || (isXS ? 10 : isSmall ? 13 : 18);
    
    let sizeStyles = 'w-8 h-8';
    if (isSmall) sizeStyles = 'w-[26px] h-[26px]';
    if (isXS) sizeStyles = 'w-[21px] h-[21px]';
    
    const baseStyles = `flex items-center justify-center rounded-full transition-all active:scale-95 shrink-0 ${sizeStyles}`;
    
    const variantStyles = {
        brand: "bg-brand text-white hover:brightness-110 shadow-sm shadow-brand/20",
        outline: "bg-[var(--bg-app)] border border-brand/50 text-brand hover:bg-brand/5",
        ghost: "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)]",
        danger: "bg-[var(--bg-app)] border border-red-500/50 text-red-500 hover:bg-red-500/5",
        success: "bg-[var(--bg-app)] border border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/5"
    };

    const disabledStyles = "opacity-50 pointer-events-none grayscale";

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
                dir={isLoading ? 'icons' : iconDir}
                size={computedIconSize} 
                className={`${isLoading ? 'animate-spin' : ''} ${iconClassName}`} 
            />
        </button>
    );
});

AppRoundButton.displayName = 'AppRoundButton';
