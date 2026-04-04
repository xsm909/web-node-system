import { useState, useEffect } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { SelectionItem } from '../../../shared/ui/selection-list/SelectionList';

interface UseParameterOptionsProps {
    param: any;
    nodeTypeId?: string;
    allParams?: any;
}

export const useParameterOptions = ({ param, nodeTypeId, allParams }: UseParameterOptionsProps) => {
    const [options, setOptions] = useState<SelectionItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (param?.options_source?.component === 'ComboBox') {
            const fetchOptions = async () => {
                setIsLoading(true);
                try {
                    let endpoint = "";
                    let requestParams = {};
                    
                    if (param.options_source.function) {
                        endpoint = `/workflows/node-types/${nodeTypeId}/parameter-options/${param.name}`;
                        requestParams = { source_func: param.options_source.function };
                    } else if (param.options_source.table === "AI_Tasks") {
                        endpoint = "/ai-tasks/";
                    } else if (param.options_source.table === "users") {
                        endpoint = "/workflows/users/";
                    } else if (param.options_source.table) {
                        endpoint = `/${param.options_source.table.toLowerCase().replace(/_/g, '-')}/`;
                    }

                    if (!endpoint) {
                        setIsLoading(false);
                        return;
                    }

                    const response = await apiClient.get(endpoint, { 
                        params: { 
                            ...requestParams,
                            params: JSON.stringify(allParams || {})
                        } 
                    });
                    const data = response.data;

                    let flatOptions: SelectionItem[] = [];
                    
                    if (param.options_source.function) {
                        flatOptions = data.map((item: any) => {
                            const val = item.value !== undefined ? item.value : (item.id !== undefined ? item.id : Object.values(item)[0]);
                            const lab = item.label !== undefined ? item.label : (item.name !== undefined ? item.name : val);
                            return {
                                id: String(val),
                                name: String(lab),
                                icon: 'bolt'
                            };
                        });
                    } else {
                        flatOptions = data
                            .filter((item: any) => {
                                if (param.options_source.filters) {
                                    return Object.entries(param.options_source.filters).every(
                                        ([key, val]) => item[key] === val
                                    );
                                }
                                return true;
                            })
                            .map((item: any) => {
                                const valField = param.options_source.value_field;
                                const labField = param.options_source.label_field;
                                
                                let val = valField ? item[valField] : undefined;
                                if (val === undefined) val = item.value !== undefined ? item.value : (item.id !== undefined ? item.id : Object.values(item)[0]);
                                
                                let lab = labField ? item[labField] : undefined;
                                if (lab === undefined) lab = item.label !== undefined ? item.label : (item.name !== undefined ? item.name : val);

                                return {
                                    id: String(val),
                                    name: String(lab),
                                    icon: 'bolt'
                                };
                            });
                    }
                        
                    setOptions(flatOptions);
                } catch (error) {
                    console.error("Failed to fetch options for", param.name, error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchOptions();
        }
    }, [param, nodeTypeId, JSON.stringify(allParams || {})]);

    return { options, isLoading };
};
