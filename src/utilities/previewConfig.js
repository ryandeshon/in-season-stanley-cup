export const hostedPreview =
  process.env.VUE_APP_HOSTED_ARCADE_PREVIEW === 'true';
export const previewEnabled =
  hostedPreview ||
  (process.env.NODE_ENV === 'development' &&
    process.env.VUE_APP_ARCADE_PREVIEW === 'true');
export const previewBase = hostedPreview
  ? `${window.location.origin}/__arcade-preview`
  : 'http://localhost:8091';

// Explicit Test-only mode. Missing endpoints fail closed instead of using prod.
export const testDraftEnabled =
  hostedPreview &&
  new URLSearchParams(window.location.search).get('draftTest') === '1';
export const testDraftApiBase = process.env.VUE_APP_TEST_DRAFT_API_BASE || '';
export const testDraftSocketUrl =
  process.env.VUE_APP_TEST_DRAFT_SOCKET_URL || '';
