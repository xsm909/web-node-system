import React, { useState } from 'react';
import { Icon } from '../icon';
import { AppFormFieldRect } from './AppFormFieldRect';
import { UI_CONSTANTS } from '../constants';

export interface AppInputAction {
    icon?: string;
    onClick: () => void;
    title?: string;
    label?: string; // Optional text next to icon
    color?: 'brand' | 'danger' | 'success' | 'warning' | 'default';
    disabled?: boolean;
    render?: () => React.ReactNode;
}

export interface AppInputProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    multiline?: boolean;
    rows?: number;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    error?: string;
    description?: string;
    className?: string;
    type?: string;
    onFocus?: () => void;
    onBlur?: () => void;
    icon?: string;
    showCopy?: boolean;
    autoFocus?: boolean;
    actions?: AppInputAction[];
    leftActions?: AppInputAction[];
}

export const AppInput: React.FC<AppInputProps> = ({
    label,
    value,
    onChange,
    multiline = false,
    rows = 4,
    placeholder,
    disabled = false,
    required = false,
    error,
    description,
    className = '',
    type = 'text',
    onFocus,
    onBlur,
    icon,
    showCopy = false,
    autoFocus = false,
    actions = [],
    leftActions = [],
}) => {
    const [copied, setCopied] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleFocus = () => {
        setIsFocused(true);
        if (onFocus) onFocus();
    };

    const handleBlur = () => {
        setIsFocused(false);
        if (onBlur) onBlur();
    };

    const allActions = [...actions];
    if (disabled && showCopy && value) {
        allActions.push({
            icon: copied ? 'check' : 'content_copy',
            onClick: handleCopy,
            title: 'Copy to clipboard',
            label: copied ? 'Copied' : undefined,
            color: 'brand',
        });
    }

    const hasActions = allActions.length > 0;
    const hasLeftActions = leftActions.length > 0;
    
    return (
        <div className={`space-y-1 ${className}`}>
            {label && (
                <label className="text-xs font-bold text-[var(--text-main)]">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            
            <AppFormFieldRect 
                isFocused={isFocused} 
                hasError={!!error} 
                disabled={disabled}
                className={`
                    ${multiline ? 'items-start h-auto' : UI_CONSTANTS.FORM_CONTROL_HEIGHT} 
                    ${hasActions ? '!pr-0' : ''} 
                    ${hasLeftActions ? '!pl-0' : ''}
                    ${hasActions || hasLeftActions ? '!py-0' : ''}
                `}
            >
                {hasLeftActions && (
                    <div className="flex items-stretch h-full shrink-0">
                        {leftActions.map((action, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick();
                                }}
                                disabled={action.disabled || disabled}
                                className={`
                                    flex items-center justify-center gap-1.5 px-2.5
                                    border-r border-[var(--border-base)]
                                    hover:bg-[var(--text-main)]/[0.03] transition-all
                                    active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                                    ${action.color === 'brand' ? 'text-brand' : ''}
                                    ${action.color === 'danger' ? 'text-red-500' : ''}
                                    ${action.color === 'success' ? 'text-green-500' : ''}
                                    ${action.color === 'warning' ? 'text-amber-500' : ''}
                                `}
                                style={{ minWidth: UI_CONSTANTS.FORM_CONTROL_HEIGHT_PX }}
                                title={action.title}
                            >
                                {action.render ? action.render() : <Icon name={action.icon || ''} size={14} />}
                                {action.label && (
                                    <span className="text-[10px] font-bold uppercase tracking-tighter">
                                        {action.label}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                <div className={`flex-1 flex items-center min-w-0 h-full ${hasActions ? 'pl-3' : ''} ${hasLeftActions ? 'pr-3' : ''}`}>
                    {multiline ? (
                        <textarea
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={placeholder}
                            disabled={disabled}
                            rows={rows}
                            className="w-full bg-transparent outline-none resize-none p-0 py-1"
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            autoFocus={autoFocus}
                        />
                    ) : (
                        <div className="flex items-center w-full h-full">
                            {icon && (
                                <div className="mr-3 opacity-40 text-[var(--text-main)] shrink-0">
                                    <Icon name={icon} size={16} />
                                </div>
                            )}
                            <input
                                type={type}
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                placeholder={placeholder}
                                disabled={disabled}
                                className="w-full bg-transparent outline-none p-0 h-full"
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                autoFocus={autoFocus}
                            />
                        </div>
                    )}
                </div>

                {hasActions && (
                    <div className="flex items-stretch h-full shrink-0">
                        {allActions.map((action, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick();
                                }}
                                disabled={action.disabled || disabled}
                                 className={`
                                    flex items-center justify-center gap-1.5 px-2.5
                                    border-l border-[var(--border-base)]
                                    hover:bg-[var(--text-main)]/[0.03] transition-all
                                    active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                                    ${action.color === 'brand' ? 'text-brand' : ''}
                                    ${action.color === 'danger' ? 'text-red-500' : ''}
                                    ${action.color === 'success' ? 'text-green-500' : ''}
                                    ${action.color === 'warning' ? 'text-amber-500' : ''}
                                `}
                                style={{ minWidth: UI_CONSTANTS.FORM_CONTROL_HEIGHT_PX }}
                                title={action.title}
                            >
                                {action.render ? action.render() : <Icon name={action.icon || ''} size={14} />}
                                {action.label && (
                                    <span className="text-[10px] font-bold uppercase tracking-tighter">
                                        {action.label}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </AppFormFieldRect>

            {description && !error && (
                <p className="text-xs text-[var(--text-muted)] opacity-60 ml-0.5">
                    {description}
                </p>
            )}
            
            {error && (
                <p className="text-xs font-bold text-red-500 ml-0.5">
                    {error}
                </p>
            )}
        </div>
    );
};

