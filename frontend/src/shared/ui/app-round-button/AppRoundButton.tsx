import React from 'react';
import { Icon } from '../icon';

interface AppRoundButtonProps {
    icon: string;
    onClick?: () => void;
    variant?: 'brand' | 'outline' | 'ghost';
    isLoading?: boolean;
    isDisabled?: boolean;
    title?: string;
    className?: string;
    iconSize?: number;
    type?: 'button' | 'submit' | 'reset';
}

export const AppRoundButton: React.FC<AppRoundButtonProps> = ({
    icon,
    onClick,
    variant = 'brand',
    isLoading = false,
    isDisabled = false,
    title,
    className = '',
    iconSize = 20,
    type = 'button'
}) => {
    const baseStyles = "flex items-center justify-center w-10 h-10 rounded-full transition-all shadow-lg active:scale-95 shrink-0";
    
    const variantStyles = {
        brand: "bg-brand text-white hover:brightness-110 shadow-brand/20",
        outline: "bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]",
        ghost: "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] shadow-none"
    };

    const disabledStyles = "opacity-50 pointer-events-none";

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={isDisabled || isLoading}
            className={`${baseStyles} ${variantStyles[variant]} ${isDisabled || isLoading ? disabledStyles : ''} ${className}`}
            title={title}
        >
            <Icon 
                name={isLoading ? 'sync' : icon} 
                size={iconSize} 
                className={isLoading ? 'animate-spin' : ''} 
            />
        </button>
    );
};
