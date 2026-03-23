export type ReportType = 'global' | 'client';

export interface ObjectParameter {
    id: string;
    parameter_name: string;
    parameter_type: 'text' | 'number' | 'date' | 'date_range' | 'select';
    default_value?: string;
    source?: string;
    value_field?: string;
    label_field?: string;
}

export type ReportParameter = ObjectParameter;

export interface ReportStyle {
    id: string;
    name: string;
    category?: string;
    css: string;
    is_default: boolean;
    is_locked: boolean;
}

export interface Report {
    id: string;
    name: string;
    type: ReportType;
    description: string;
    code: string;
    schema_json: Record<string, any>;
    template: string;
    style_id?: string;
    category?: string;
    created_by: string;
    is_locked: boolean;
    parameters: ObjectParameter[];
    project_id?: string | null;
    meta?: Record<string, any>;
}
