import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Icon } from '../icon';
import { AppInput } from '../app-input';

export interface AppCategoryInputProps {
    value: string;
    onChange: (v: string) => void;
    allPaths: string[];
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    required?: boolean;
}

export const AppCategoryInput: React.FC<AppCategoryInputProps> = ({ 
    value, 
    onChange, 
    allPaths,
    label = "Category",
    placeholder = "e.g. AI|Chat",
    disabled = false,
    className = "",
    required = false,
}) => {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => { setInputValue(value); }, [value]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = useMemo(() => {
        const q = (inputValue || '').toLowerCase();
        return q ? allPaths.filter(p => p.toLowerCase().includes(q)) : allPaths;
    }, [allPaths, inputValue]);

    const handleSelect = (path: string) => {
        setInputValue(path);
        onChange(path);
        setOpen(false);
    };

    const handleInputChange = (v: string) => {
        setInputValue(v);
        onChange(v);
        setOpen(true);
    };

    return (
        <div ref={ref} className={`relative ${className}`}>
            <AppInput
                label={label}
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => !disabled && setOpen(true)}
                placeholder={placeholder}
                disabled={disabled}
                required={required}
            />
            {!disabled && (
                <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-4 top-[38px] -translate-y-1/2 opacity-40 hover:opacity-80 transition-opacity text-[var(--text-main)]"
                    onClick={() => setOpen(o => !o)}
                >
                    <Icon name={open ? 'expand_less' : 'expand_more'} size={16} />
                </button>
            )}


            {open && !disabled && filtered.length > 0 && (
                <div className="absolute z-50 top-full mt-2 left-0 right-0 bg-[var(--bg-app)] border border-[var(--border-base)] rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
                    {filtered.map(path => {
                        const parts = path.split('|');
                        const depth = parts.length - 1;
                        const isLeaf = !allPaths.some(p => p.startsWith(path + '|'));
                        return (
                            <button
                                key={path}
                                type="button"
                                className={`w-full text-left px-5 py-2.5 text-sm transition-colors hover:bg-brand/10 hover:text-brand flex items-center gap-2 ${value === path ? 'bg-brand/10 text-brand' : 'text-[var(--text-muted)]'}`}
                                style={{ paddingLeft: `${20 + depth * 16}px` }}
                                onClick={() => handleSelect(path)}
                            >
                                <span className={`text-[10px] mr-1 opacity-40 ${isLeaf ? '' : 'text-brand'}`}>
                                    {isLeaf ? '●' : '▶'}
                                </span>
                                <span className="font-bold">{parts[parts.length - 1]}</span>
                                {depth > 0 && (
                                    <span className="text-[10px] opacity-40 ml-auto font-mono">
                                        {parts.slice(0, -1).join(' › ')}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
