export const isMetadataEqual = (a: any, b: any) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.id === b.id &&
           a.title === b.title &&
           a.icon === b.icon &&
           a.projectId === b.projectId &&
           a.isDirty === b.isDirty;
};
