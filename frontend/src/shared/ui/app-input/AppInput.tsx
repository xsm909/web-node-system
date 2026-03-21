import React, { useState } from 'react';
import { Icon } from '../icon';

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
    showCopy?: boolean; // New prop to show copy button
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
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Keep border and label normal, only fade the inner text when disabled
    const baseStyles = "w-full px-4 py-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:border-brand transition-all outline-none disabled:cursor-not-allowed disabled:text-[var(--text-muted)] disabled:opacity-100 placeholder:text-[var(--text-muted)]";
    
    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label className="text-sm font-bold text-[var(--text-main)]">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            
            <div className="relative group/input">
                {multiline ? (
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        disabled={disabled}
                        rows={rows}
                        className={`${baseStyles} resize-none`}
                        onFocus={onFocus}
                        onBlur={onBlur}
                    />
                ) : (
                    <div className="relative flex items-center">
                        <input
                            type={type}
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={placeholder}
                            disabled={disabled}
                            className={`${baseStyles} ${icon ? 'pl-10' : ''} ${(disabled && showCopy) ? 'pr-12' : ''}`}
                            onFocus={onFocus}
                            onBlur={onBlur}
                        />
                        {icon && (
                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40 text-[var(--text-main)]">
                                <Icon name={icon} size={16} />
                            </div>
                        )}
                        
                        {disabled && showCopy && value && (
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="absolute right-2 p-2 rounded-lg hover:bg-brand/10 text-brand transition-all flex items-center gap-1.5 active:scale-95"
                                title="Copy to clipboard"
                            >
                                <Icon name={copied ? 'check' : 'content_copy'} size={14} />
                                {copied && <span className="text-[10px] font-bold uppercase tracking-tighter">Copied</span>}
                            </button>
                        )}
                    </div>
                )}
            </div>

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
