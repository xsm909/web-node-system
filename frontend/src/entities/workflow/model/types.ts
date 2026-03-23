import type { ObjectParameter } from "../../report/model/types";

export interface Workflow {
    id: string;
    name: string;
    status?: string;
    owner_id: string;
    project_id?: string | null;
    workflow_data?: any;
    runtime_data?: any;
    graph?: any;
    category?: string;
    parameters: ObjectParameter[];
    is_locked: boolean;
}
