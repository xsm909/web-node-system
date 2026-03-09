import React from 'react';
import FormRaw from '@rjsf/core';
import validatorRaw from '@rjsf/validator-ajv8';
import type {
    BaseInputTemplateProps,
    FieldTemplateProps,
    ObjectFieldTemplateProps,
    ArrayFieldTemplateProps,
    WidgetProps,
} from '@rjsf/utils';
import { getInputProps } from '@rjsf/utils';
import { Icon } from '../../shared/ui/icon';

// ─── Interop Handles ───────────────────────────────────────────────────────────
const getInterop = (mod: any) => mod?.default || mod;
const Form = getInterop(FormRaw);
const validator = getInterop(validatorRaw);

// ─── Base Input ────────────────────────────────────────────────────────────────
function BaseInputTemplate(props: BaseInputTemplateProps) {
    const {
        id, value, type, placeholder, required, disabled, readonly,
        onChange, onBlur, onFocus, options, schema,
    } = props;
    const inputProps = getInputProps(schema, type, options);

    // Safety check for objects in primitive fields
    const displayValue = (typeof value === 'object' && value !== null)
        ? JSON.stringify(value)
        : (value ?? '');

    return (
        <input
            id={id}
            name={id}
            type={inputProps.type ?? 'text'}
            value={displayValue}
            placeholder={placeholder}
            required={required}
            disabled={disabled || readonly}
            step={inputProps.step}
            min={inputProps.min}
            max={inputProps.max}
            onChange={(e) => onChange(e.target.value === '' ? options.emptyValue : e.target.value)}
            onBlur={(e) => onBlur(id, e.target.value)}
            onFocus={(e) => onFocus(id, e.target.value)}
            className="w-full bg-surface-950 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
    );
}

// ─── Textarea Widget ───────────────────────────────────────────────────────────
function TextareaWidget(props: WidgetProps) {
    const { id, value, placeholder, required, disabled, readonly, onChange, onBlur, onFocus, options } = props;

    // Safety check for objects in primitive fields
    const displayValue = (typeof value === 'object' && value !== null)
        ? JSON.stringify(value)
        : (value ?? '');

    return (
        <textarea
            id={id}
            name={id}
            value={displayValue}
            placeholder={placeholder}
            required={required}
            disabled={disabled || readonly}
            rows={4}
            onChange={(e) => onChange(e.target.value === '' ? options.emptyValue : e.target.value)}
            onBlur={(e) => onBlur(id, e.target.value)}
            onFocus={(e) => onFocus(id, e.target.value)}
            className="w-full bg-surface-950 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all resize-none disabled:opacity-50"
        />
    );
}

// ─── Select Widget ─────────────────────────────────────────────────────────────
function SelectWidget(props: WidgetProps) {
    const { id, value, options, required, disabled, readonly, onChange } = props;
    const { enumOptions } = options;
    return (
        <select
            id={id}
            name={id}
            value={value ?? ''}
            required={required}
            disabled={disabled || readonly}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-surface-950 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-[var(--text-main)] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all appearance-none disabled:opacity-50"
        >
            {!required && <option value="">— Select —</option>}
            {(enumOptions as { value: unknown; label: string }[] | undefined)?.map((opt) => (
                <option key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                </option>
            ))}
        </select>
    );
}

// ─── Checkbox Widget ───────────────────────────────────────────────────────────
function CheckboxWidget(props: WidgetProps) {
    const { id, value, disabled, readonly, onChange, label } = props;
    return (
        <label htmlFor={id} className="flex items-center gap-3 cursor-pointer group">
            <div className="relative flex-shrink-0">
                <input
                    id={id}
                    name={id}
                    type="checkbox"
                    checked={!!value}
                    disabled={disabled || readonly}
                    onChange={(e) => onChange(e.target.checked)}
                    className="sr-only peer"
                />
                <div className="w-5 h-5 rounded-md border border-gray-600 bg-surface-950 peer-checked:bg-brand peer-checked:border-brand transition-all flex items-center justify-center">
                    {!!value && <Icon name="check" size={12} className="text-white" />}
                </div>
            </div>
            <span className="text-sm text-[var(--text-main)]">{label}</span>
        </label>
    );
}

// ─── Field Template ────────────────────────────────────────────────────────────
function FieldTemplate(props: FieldTemplateProps) {
    const { id, label, required, children, errors, description, hidden, displayLabel } = props;
    if (hidden) return <>{children}</>;

    // Safety check for errors/description to prevent [object Object] rendering
    const renderedErrors = React.isValidElement(errors) ? errors : (typeof errors === 'string' ? errors : null);
    const renderedDescription = React.isValidElement(description) ? description : (typeof description === 'string' ? description : null);

    return (
        <div className="flex flex-col gap-1.5 mb-4">
            {displayLabel && label && (
                <label htmlFor={id} className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    {label}
                    {required && <span className="text-brand ml-1">*</span>}
                </label>
            )}
            {renderedDescription && (
                <div className="text-[11px] text-[var(--text-muted)] opacity-60 -mt-1">{renderedDescription}</div>
            )}
            {children}
            {renderedErrors && (
                <div className="text-[11px] text-red-400 font-medium">{renderedErrors}</div>
            )}
        </div>
    );
}

// ─── Object Field Template ─────────────────────────────────────────────────────
function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
    const { title, description, properties, schema } = props;

    const renderedDescription = React.isValidElement(description) ? description : (typeof description === 'string' ? description : null);

    return (
        <div className="space-y-4">
            {title && (
                <div className="pb-3 border-b border-gray-700/50">
                    <h3 className="text-sm font-bold text-[var(--text-main)]">{title}</h3>
                    {renderedDescription && (
                        <div className="text-xs text-[var(--text-muted)] opacity-60 mt-0.5">{renderedDescription}</div>
                    )}
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {properties.map((prop) => {
                    const propSchema = (schema.properties as any)?.[prop.name] || {};
                    const isFullWidth = propSchema.type === 'object' || propSchema.type === 'array';

                    return (
                        <div key={prop.name} className={isFullWidth ? 'sm:col-span-2' : ''}>
                            {prop.content}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Array Field Template ──────────────────────────────────────────────────────
function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
    const { title, items, canAdd, onAddClick } = props;
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                {title && (
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {title}
                    </span>
                )}
                {canAdd && (
                    <button
                        type="button"
                        onClick={onAddClick}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand border border-brand/30 rounded-lg hover:bg-brand/10 transition-colors ml-auto"
                    >
                        <Icon name="add" size={14} />
                        Add Item
                    </button>
                )}
            </div>
            <div className="space-y-2">
                {items.map((item: any) => (
                    <div key={item.key} className="flex items-start gap-2 p-3 rounded-xl bg-surface-900/50 border border-gray-700/50">
                        <div className="flex-1">{item.children}</div>
                        <div className="flex gap-1 mt-1 shrink-0">
                            {item.hasMoveUp && (
                                <button type="button" onClick={item.onReorderClick(item.index, item.index - 1)}
                                    className="p-1.5 rounded-lg text-gray-500 hover:text-[var(--text-main)] hover:bg-surface-700 transition-colors">
                                    <Icon name="up" size={14} />
                                </button>
                            )}
                            {item.hasMoveDown && (
                                <button type="button" onClick={item.onReorderClick(item.index, item.index + 1)}
                                    className="p-1.5 rounded-lg text-gray-500 hover:text-[var(--text-main)] hover:bg-surface-700 transition-colors">
                                    <Icon name="down" size={14} />
                                </button>
                            )}
                            {item.hasRemove && (
                                <button type="button" onClick={item.onDropIndexClick(item.index)}
                                    className="p-1.5 rounded-lg text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-colors">
                                    <Icon name="delete" size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {items.length === 0 && (
                <div className="text-xs text-[var(--text-muted)] italic opacity-50 px-1">No items yet</div>
            )}
        </div>
    );
}

// ─── Main RjsfForm Component ───────────────────────────────────────────────────
interface RjsfFormProps {
    schema: Record<string, unknown>;
    uiSchema?: Record<string, unknown>;
    formData: unknown;
    onChange: (data: unknown, isValid: boolean) => void;
    readOnly?: boolean;
}

export const RjsfForm: React.FC<RjsfFormProps> = ({
    schema,
    uiSchema,
    formData,
    onChange,
    readOnly = false,
}) => {
    // Interop safety: check if Form component is valid
    if (typeof Form !== 'function' && typeof Form !== 'object') {
        return (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                Error: Form component is not valid ({typeof Form}).
            </div>
        );
    }

    const resolvedUiSchema: Record<string, unknown> = {
        'ui:submitButtonOptions': { norender: true },
        ...(readOnly ? { 'ui:readonly': true } : {}),
        ...uiSchema,
    };

    const safeSchema = schema && typeof schema === 'object' ? schema : { type: 'object' };

    return (
        <>
            <Form
                schema={safeSchema as any}
                uiSchema={resolvedUiSchema}
                formData={formData}
                validator={validator}
                templates={{
                    BaseInputTemplate,
                    FieldTemplate,
                    ObjectFieldTemplate,
                    ArrayFieldTemplate,
                }}
                widgets={{
                    TextareaWidget,
                    SelectWidget,
                    CheckboxWidget,
                }}
                onChange={(e: any) => {
                    const errors = e.errors ?? [];
                    onChange(e.formData, errors.length === 0);
                }}
                onSubmit={() => { }}
                liveValidate={false}
                showErrorList={false}
            />
            <div className="mt-4 p-2 text-[10px] text-gray-500 border-t border-gray-800 font-mono break-all line-clamp-2 overflow-hidden hover:line-clamp-none transition-all cursor-help opacity-30">
                DEBUG Schema: {JSON.stringify(safeSchema)} | Data type: {typeof formData}
            </div>
        </>
    );
};
