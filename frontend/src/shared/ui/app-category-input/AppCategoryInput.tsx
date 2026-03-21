import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { Icon } from '../icon';
import { AppInput } from '../app-input';
import { createPortal } from 'react-dom';

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
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });
    const ref = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setInputValue(value); }, [value]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const isInsideInput = ref.current?.contains(e.target as Node);
            const isInsideDropdown = dropdownRef.current?.contains(e.target as Node);
            if (!isInsideInput && !isInsideDropdown) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const updateCoords = () => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            setCoords({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
        }
    };

    useLayoutEffect(() => {
        if (open) {
            updateCoords();
            window.addEventListener('scroll', updateCoords, true);
            window.addEventListener('resize', updateCoords);
        }
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [open]);

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


            {open && !disabled && filtered.length > 0 && coords.width > 0 && typeof document !== 'undefined' && createPortal(
                <div 
                    ref={dropdownRef}
                    className="fixed z-[3000] mt-1 bg-[var(--bg-app)] border border-[var(--border-base)] rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-300 ease-out"
                    style={{
                        top: coords.top + coords.height,
                        left: coords.left,
                        width: coords.width,
                    }}
                >
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
                </div>,
                document.body
            )}
        </div>
    );
};
