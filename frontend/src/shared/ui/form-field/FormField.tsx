import React from 'react';

interface FormFieldProps {
    label: string;
    children: React.ReactNode;
    description?: string;
    error?: string;
    className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
    label,
    children,
    description,
    error,
    className = '',
}) => {
    return (
        <div className={`space-y-2 ${className}`}>
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">
                {label}
            </label>
            <div className="relative">
                {children}
            </div>
            {description && (
                <p className="text-[10px] text-[var(--text-muted)] italic opacity-60 ml-1 mt-2">
                    {description}
                </p>
            )}
            {error && (
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest ml-1 mt-1">
                    {error}
                </p>
            )}
        </div>
    );
};
