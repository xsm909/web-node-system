import React from 'react';
import { ComboBox } from '../combo-box/ComboBox';
import { Icon } from '../icon';
import type { ObjectParameter as ReportParameter } from '../../../entities/report/model/types';

interface AppParameterSelectByTamplateProps {
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
}) => {
    console.log(`AppParameterSelectByTamplate [${parameter.parameter_name}] options:`, options);
    if (parameter.parameter_type === 'select') {
        const errorOption = options.find(o => String(o.value) === 'error');
        if (errorOption) {
            return (
                <div className={`w-full px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2 ${className}`}>
                    <Icon name="error" className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{errorOption.label || 'Error source'}</span>
                </div>
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
                className={`w-full bg-[var(--bg-app)] border border-[var(--border-base)] rounded-xl ${className}`}
                disabled={disabled}
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
                <input
                    type="date"
                    value={sValue}
                    onChange={(e) => handleStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:outline-none focus:border-brand disabled:opacity-50"
                    disabled={disabled}
                />
                <input
                    type="date"
                    value={eValue}
                    onChange={(e) => handleEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:outline-none focus:border-brand disabled:opacity-50"
                    disabled={disabled}
                />
            </div>
        );
    }

    return (
        <input
            type={parameter.parameter_type === 'number' ? 'number' : parameter.parameter_type === 'date' ? 'date' : 'text'}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:outline-none focus:border-brand disabled:opacity-50 ${className}`}
            placeholder={placeholder || `Enter ${parameter.parameter_name}...`}
            disabled={disabled}
        />
    );
};
