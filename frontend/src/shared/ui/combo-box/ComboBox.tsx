import React, { useState, useRef } from 'react';
import { Icon } from '../icon';
import { SelectionList, type SelectionGroup, type SelectionItem, type SelectionAction, type SelectionListConfig } from '../selection-list';
import { AppFormFieldRect } from '../app-input/AppFormFieldRect';
import { AppRoundButton } from '../app-round-button/AppRoundButton';
import { UI_CONSTANTS } from '../constants';

interface ComboBoxProps {
// ... (omitted props for brevity, but I must provide full target content)
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
    size?: 'normal' | 'small';
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
    size = 'normal'
}) => {
    const isSmall = size === 'small';
    const computedIconSize = iconSize || (isSmall ? 14 : 16);
    
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

    return (
        <div className={`relative ${isSidebar ? 'w-full' : ''} ${className}`}>
            {isIconOnly ? (
                <AppRoundButton
                    ref={triggerRef}
                    icon={icon || ''}
                    onClick={toggleOpen}
                    isDisabled={disabled}
                    variant={isBrand ? 'brand' : 'outline'}
                    size={size}
                    iconSize={computedIconSize}
                    title={title}
                    className={triggerClassName}
                />
            ) : (
                <AppFormFieldRect
                    as="button"
                    type="button"
                    ref={triggerRef}
                    onClick={toggleOpen}
                    disabled={disabled}
                    isFocused={isOpen}
                    title={title}
                    className={`
                        justify-start ${UI_CONSTANTS.FORM_CONTROL_HEIGHT}
                        ${isSidebar ? 'w-full' : 'max-w-full'}
                        ${triggerClassName}
                    `}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        {icon && (
                            <Icon
                                name={icon}
                                size={computedIconSize}
                                className={`${isBrand ? 'text-white' : (isOpen || value ? 'text-brand' : '')} ${iconClassName || ''}`}
                            />
                        )}
                        {(label || subLabel || (placeholder && !isIconOnly)) && (
                            <div className="flex flex-col items-start min-w-0">
                                {label && (
                                    <span className={`text-xs font-normal truncate w-full ${labelClassName}`}>
                                        {label}
                                    </span>
                                )}
                                {!label && placeholder && (
                                    <span className="text-[10px] opacity-50">{placeholder}</span>
                                )}
                                {subLabel && (
                                    <span className="text-[10px] text-[var(--text-muted)] font-normal opacity-60">
                                        {subLabel}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    {!hideChevron && (
                        <Icon
                            name="chevron_down"
                            size={14}
                            className={`transition-transform duration-200 ml-auto ${isOpen ? 'rotate-180' : 'opacity-30 group-hover:opacity-60'}`}
                        />
                    )}
                </AppFormFieldRect>
            )}

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
