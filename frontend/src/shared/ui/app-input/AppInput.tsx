import React from 'react';
import { Icon } from '../icon';

export interface AppInputProps {

    label: string;
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
}) => {


    const baseStyles = "w-full px-4 py-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:border-brand transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-[var(--text-muted)]";
    
    return (
        <div className={`space-y-1.5 ${className}`}>
            <label className="text-sm font-bold text-[var(--text-main)]">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            
            <div className="relative">
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
                    <>
                        <input
                            type={type}
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={placeholder}
                            disabled={disabled}
                            className={`${baseStyles} ${icon ? 'pl-10' : ''}`}
                            onFocus={onFocus}
                            onBlur={onBlur}
                        />
                        {icon && (
                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40 text-[var(--text-main)]">
                                <Icon name={icon} size={16} />
                            </div>
                        )}
                    </>
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
