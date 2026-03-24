import React from 'react';
import { ComboBox } from '../combo-box/ComboBox';
import { AppFormFieldRect } from "../app-input";
import { Icon } from '../icon';
import type { ObjectParameter as ReportParameter } from '../../../entities/report/model/types';
import { UI_CONSTANTS } from '../constants';

interface AppParameterSelectByTamplateProps {
// ...
    parameter: ReportParameter;
    value: any;
    onChange: (value: any) => void;
    // For date_range, we might need separate values if parent stores them separately
    startValue?: string;
    endValue?: string;
    onStartChange?: (value: string) => void;
    onEndChange?: (value: string) => void;
    options?: { value: string, label: string }[];
    placeholder?: string;
    className?: string;
    variant?: 'primary' | 'ghost';
    disabled?: boolean;
    align?: 'left' | 'right';
}

export const AppParameterSelectByTamplate: React.FC<AppParameterSelectByTamplateProps> = ({
    parameter,
    value,
    onChange,
    startValue,
    endValue,
    onStartChange,
    onEndChange,
    options = [],
    placeholder,
    className = '',
    variant = 'primary',
    disabled = false,
    align = 'left'
}) => {
    if (parameter.parameter_type === 'select') {
        const errorOption = options.find(o => String(o.value) === 'error');
        if (errorOption) {
            return (
                <AppFormFieldRect hasError={true} className={`!bg-red-50 !border-red-200 !text-red-600 ${UI_CONSTANTS.FORM_CONTROL_HEIGHT} ${className}`}>
                    <Icon name="error" className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{errorOption.label || 'Error source'}</span>
                </AppFormFieldRect>
            );
        }

        const selectedOption = options.find(o => String(o.value) === String(value));
        const currentLabel = selectedOption?.label || (value !== undefined && value !== null ? String(value) : undefined);
        
        return (
            <ComboBox
                value={value !== undefined && value !== null ? String(value) : undefined}
                label={currentLabel || 'Select...'}
                placeholder={placeholder || `Select ${parameter.parameter_name}...`}
                items={options.map(opt => ({
                    id: String(opt.value),
                    name: opt.label || String(opt.value)
                }))}
                onSelect={(item) => onChange(item.id)}
                variant={variant}
                className={className}
                disabled={disabled}
                align={align}
            />
        );
    }

    if (parameter.parameter_type === 'date_range') {
        const sValue = startValue !== undefined ? startValue : (typeof value === 'object' ? value?.start : (typeof value === 'string' && value.includes(',') ? value.split(',')[0] : value)) || '';
        const eValue = endValue !== undefined ? endValue : (typeof value === 'object' ? value?.end : (typeof value === 'string' && value.includes(',') ? value.split(',')[1] : value)) || '';

        const handleStart = (v: string) => {
            if (onStartChange) onStartChange(v);
            else if (typeof value === 'object') onChange({ ...value, start: v });
            else onChange(`${v},${eValue}`);
        };

        const handleEnd = (v: string) => {
            if (onEndChange) onEndChange(v);
            else if (typeof value === 'object') onChange({ ...value, end: v });
            else onChange(`${sValue},${v}`);
        };

        return (
            <div className={`grid grid-cols-2 gap-2 ${className}`}>
                <AppFormFieldRect className={`cursor-pointer ${UI_CONSTANTS.FORM_CONTROL_HEIGHT}`}>
                    <input
                        type="date"
                        value={sValue}
                        onChange={(e) => handleStart(e.target.value)}
                        className="w-full bg-transparent outline-none h-full text-xs font-normal"
                        disabled={disabled}
                    />
                </AppFormFieldRect>
                <AppFormFieldRect className={`cursor-pointer ${UI_CONSTANTS.FORM_CONTROL_HEIGHT}`}>
                    <input
                        type="date"
                        value={eValue}
                        onChange={(e) => handleEnd(e.target.value)}
                        className="w-full bg-transparent outline-none h-full text-xs font-normal"
                        disabled={disabled}
                    />
                </AppFormFieldRect>
            </div>
        );
    }

    return (
        <AppFormFieldRect className={`${UI_CONSTANTS.FORM_CONTROL_HEIGHT} ${className}`} disabled={disabled}>
            <input
                type={parameter.parameter_type === 'number' ? 'number' : parameter.parameter_type === 'date' ? 'date' : 'text'}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-transparent outline-none h-full text-xs font-normal"
                placeholder={placeholder || `Enter ${parameter.parameter_name}...`}
                disabled={disabled}
            />
        </AppFormFieldRect>
    );
};
