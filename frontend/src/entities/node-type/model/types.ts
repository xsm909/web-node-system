export interface NodeType {
    id: number;
    name: string;
    version: string;
    description: string;
    code: string;
    input_schema: any;
    output_schema: any;
    parameters?: any[];
    is_async: boolean;
}
