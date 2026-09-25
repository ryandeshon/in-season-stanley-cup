import { ref } from 'vue';
// Diagnostic controls are only honored in the explicitly enabled Test draft.
export const draftSocketOnly = ref(true);
export const draftEventCount = ref(0);
export const draftLastEventAt = ref('None yet');
