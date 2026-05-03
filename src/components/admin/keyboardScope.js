export const isEditableKeyTarget = (target) => {
    if (!target) return false;

    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
        || target.isContentEditable
        || !!target.closest?.('[data-vote-input-scope]');
};

export const shouldHandleGlobalShortcut = (event) => {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
        return false;
    }

    return !isEditableKeyTarget(event.target || document.activeElement);
};
