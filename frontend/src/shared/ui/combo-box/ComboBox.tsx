import React, { useState, useRef } from 'react';
import { Icon } from '../icon';
import { SelectionList, type SelectionGroup, type SelectionItem, type SelectionAction, type SelectionListConfig } from '../selection-list';

interface ComboBoxProps {
    value?: string;
    label?: string;
    subLabel?: string;
    icon?: string;
    placeholder?: string;
    data?: Record<string, SelectionGroup>;
    items?: SelectionItem[];
    config?: SelectionListConfig;
    onSelect: (item: SelectionItem) => void;
    onAction?: (action: SelectionAction, target: SelectionItem | SelectionGroup) => void;
    onOpenChange?: (open: boolean) => void;
    className?: string;
    triggerClassName?: string;
    labelClassName?: string;
    iconSize?: number;
    variant?: 'primary' | 'ghost' | 'sidebar' | 'brand';
    searchPlaceholder?: string;
    disabled?: boolean;
    iconClassName?: string;
    title?: string;
    hideChevron?: boolean;
}

export const ComboBox: React.FC<ComboBoxProps> = ({
    value,
    label,
    subLabel,
    icon,
    placeholder = 'Select...',
    data = {},
    items,
    config,
    onSelect,
    onAction,
    onOpenChange,
    className = '',
    triggerClassName = '',
    labelClassName = '',
    iconSize = 16,
    variant = 'primary',
    searchPlaceholder,
    disabled,
    iconClassName,
    title,
    hideChevron = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const toggleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        const nextOpen = !isOpen;
        setIsOpen(nextOpen);
        if (onOpenChange) onOpenChange(nextOpen);
    };

    const handleSelect = (item: SelectionItem) => {
        onSelect(item);
        setIsOpen(false);
        if (onOpenChange) onOpenChange(false);
    };

    const handleAction = (action: SelectionAction, target: SelectionItem | SelectionGroup) => {
        if (onAction) {
            onAction(action, target);
        }
        setIsOpen(false);
        if (onOpenChange) onOpenChange(false);
    };

    const isSidebar = variant === 'sidebar';
    const isBrand = variant === 'brand';
    const isIconOnly = !label && !subLabel && (!placeholder || placeholder === '');

    const triggerClasses = `flex items-center gap-2 transition-all ${
        isIconOnly ? 'p-0 justify-center' : 'px-3 py-1.5 justify-start'
    } ${isSidebar ? 'w-full' : 'max-w-full'} ${
        triggerClassName.includes('rounded-full') ? 'rounded-full' : 'rounded-xl'
    } ${isBrand
        ? 'bg-brand text-white shadow-md shadow-brand/10 hover:brightness-110 active:scale-95'
        : isOpen ? 'bg-[var(--border-base)] text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:bg-[var(--border-muted)] hover:text-[var(--text-main)]'
    } ${disabled ? 'opacity-50 pointer-events-none' : ''} ${triggerClassName}`;

    return (
        <div className={`relative ${isSidebar ? 'w-full' : ''} ${className}`}>
            <button
                type="button"
                ref={triggerRef}
                onClick={toggleOpen}
                className={triggerClasses}
                disabled={disabled}
                title={title}
            >
                <div className={`flex items-center gap-3 min-w-0 ${isIconOnly ? 'justify-center' : ''}`}>
                    {icon && (
                        <Icon
                            name={icon}
                            size={iconSize}
                            className={`${isBrand ? 'text-white' : (isOpen || value ? 'text-brand' : '')} ${iconClassName || ''}`}
                        />
                    )}
                    {(label || subLabel || (placeholder && !isIconOnly)) && (
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
                    )}
                </div>
                {!hideChevron && !isIconOnly && (
                    <Icon
                        name="chevron_down"
                        size={14}
                        className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : 'opacity-30 group-hover:opacity-60'}`}
                    />
                )}
            </button>

            {isOpen && (
                <SelectionList
                    data={data}
                    items={items}
                    config={config}
                    activeItemId={value}
                    onSelect={handleSelect}
                    onAction={handleAction}
                    onClose={() => {
                        setIsOpen(false);
                        if (onOpenChange) onOpenChange(false);
                    }}
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
