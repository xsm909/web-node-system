import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';

interface IconPickerProps {
    value: string;
    onChange: (value: string) => void;
}

export const IconPicker: React.FC<IconPickerProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [availableIcons, setAvailableIcons] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Dynamically discover icons from assets
        const icons = import.meta.glob('../../../assets/node_icons/*.svg');
        const iconNames = Object.keys(icons).map((path) =>
            path.split('/').pop()?.replace('.svg', '') || ''
        ).filter(Boolean);
        setAvailableIcons(iconNames);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] hover:border-brand/50 transition-all font-bold group"
            >
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand border border-brand/20 group-hover:bg-brand/20 transition-all">
                    <Icon name={value || 'task'} dir="node_icons" size={24} />
                </div>
                <span className="flex-1 text-left opacity-80 group-hover:opacity-100">
                    {value ? (value.charAt(0).toUpperCase() + value.slice(1)) : 'Select Icon'}
                </span>
                <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} opacity-40`}
                >
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-3 p-4 bg-surface-800 border border-[var(--border-base)] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] animate-in zoom-in-95 fade-in duration-200 backdrop-blur-xl">
                    <div className="grid grid-cols-5 gap-3 max-h-[280px] overflow-y-auto custom-scrollbar p-1">
                        {availableIcons.map((iconName) => (
                            <button
                                key={iconName}
                                type="button"
                                onClick={() => {
                                    onChange(iconName);
                                    setIsOpen(false);
                                }}
                                className={`aspect-square rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-90 ${value === iconName
                                        ? 'bg-brand text-white shadow-lg shadow-brand/30'
                                        : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-base)] hover:border-brand/30'
                                    }`}
                                title={iconName}
                            >
                                <Icon name={iconName} dir="node_icons" size={24} />
                            </button>
                        ))}
                    </div>
                    {availableIcons.length === 0 && (
                        <div className="py-8 text-center text-xs font-black uppercase tracking-widest opacity-40">
                            No icons found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
