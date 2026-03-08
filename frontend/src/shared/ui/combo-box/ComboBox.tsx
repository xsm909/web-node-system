import React, { useState, useRef } from 'react';
import { Icon } from '../icon';
import { SelectionList, type SelectionGroup, type SelectionItem, type SelectionAction, type SelectionListConfig } from '../selection-list';

interface ComboBoxProps {
    value?: string;
    label?: string;
    subLabel?: string;
    icon?: string;
    placeholder?: string;
    data: Record<string, SelectionGroup>;
    config?: SelectionListConfig;
    onSelect: (item: SelectionItem) => void;
    onAction?: (action: SelectionAction, target: SelectionItem | SelectionGroup) => void;
    className?: string;
    triggerClassName?: string;
    labelClassName?: string;
    iconSize?: number;
    variant?: 'primary' | 'ghost' | 'sidebar' | 'brand';
    searchPlaceholder?: string;
}

export const ComboBox: React.FC<ComboBoxProps> = ({
    value,
    label,
    subLabel,
    icon,
    placeholder = 'Select...',
    data,
    config,
    onSelect,
    onAction,
    className = '',
    triggerClassName = '',
    labelClassName = '',
    iconSize = 16,
    variant = 'primary',
    searchPlaceholder,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const handleSelect = (item: SelectionItem) => {
        onSelect(item);
        setIsOpen(false);
    };

    const handleAction = (action: SelectionAction, target: SelectionItem | SelectionGroup) => {
        if (onAction) {
            onAction(action, target);
        }
        // Common behavior: close on action (like rename/add)
        setIsOpen(false);
    };

    const isSidebar = variant === 'sidebar';
    const isBrand = variant === 'brand';

    const triggerClasses = `flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${isSidebar ? 'w-full justify-between' : 'max-w-full justify-start'
        } ${isBrand
            ? 'bg-brand text-white shadow-md shadow-brand/10 hover:brightness-110 active:scale-95'
            : isOpen ? 'bg-[var(--border-base)] text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:bg-[var(--border-muted)] hover:text-[var(--text-main)]'
        } ${triggerClassName}`;

    return (
        <div className={`relative ${isSidebar ? 'w-full' : ''} ${className}`}>
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className={triggerClasses}
            >
                <div className="flex items-center gap-3 min-w-0">
                    {icon && (
                        <Icon
                            name={icon}
                            size={iconSize}
                            className={isBrand ? 'text-white' : (isOpen || value ? 'text-brand' : '')}
                        />
                    )}
                    <div className="flex flex-col items-start min-w-0">
                        {label && (
                            <span className={`text-sm font-semibold truncate w-full ${labelClassName}`}>
                                {label}
                            </span>
                        )}
                        {!label && placeholder && (
                            <span className="text-xs opacity-50">{placeholder}</span>
                        )}
                        {subLabel && (
                            <span className="text-[10px] text-[var(--text-muted)] font-medium opacity-60">
                                {subLabel}
                            </span>
                        )}
                    </div>
                </div>
                <Icon
                    name="chevron_down"
                    size={14}
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : 'opacity-30 group-hover:opacity-60'}`}
                />
            </button>

            {isOpen && (
                <SelectionList
                    data={data}
                    config={config}
                    activeItemId={value}
                    onSelect={handleSelect}
                    onAction={handleAction}
                    onClose={() => setIsOpen(false)}
                    searchPlaceholder={searchPlaceholder}
                    position={triggerRef.current ? {
                        x: triggerRef.current.getBoundingClientRect().left,
                        y: triggerRef.current.getBoundingClientRect().bottom + 8
                    } : undefined}
                />
            )}
        </div>
    );
};
