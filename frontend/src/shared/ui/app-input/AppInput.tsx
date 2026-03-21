import React, { useState } from 'react';
import { Icon } from '../icon';
import { AppFormFieldRect } from './AppFormFieldRect';

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
                className={multiline ? 'items-start h-auto' : ''}
            >
                {multiline ? (
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        disabled={disabled}
                        rows={rows}
                        className="w-full bg-transparent outline-none resize-none p-0"
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        autoFocus={autoFocus}
                    />
                ) : (
                    <div className="relative flex items-center w-full">
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
                            className={`w-full bg-transparent outline-none p-0 ${(disabled && showCopy) ? 'pr-12' : ''}`}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            autoFocus={autoFocus}
                        />
                        
                        {disabled && showCopy && value && (
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="absolute right-0 p-1.5 rounded-lg hover:bg-brand/10 text-brand transition-all flex items-center gap-1.5 active:scale-95"
                                title="Copy to clipboard"
                            >
                                <Icon name={copied ? 'check' : 'content_copy'} size={14} />
                                {copied && <span className="text-[10px] font-bold uppercase tracking-tighter">Copied</span>}
                            </button>
                        )}
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
