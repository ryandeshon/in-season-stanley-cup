export const hostedPreview =
  process.env.VUE_APP_HOSTED_ARCADE_PREVIEW === 'true';
export const previewEnabled =
  hostedPreview ||
  (process.env.NODE_ENV === 'development' &&
    process.env.VUE_APP_ARCADE_PREVIEW === 'true');
export const previewBase = hostedPreview
  ? `${window.location.origin}/__arcade-preview`
  : 'http://localhost:8091';

// Every draft route on hosted Test uses browser-local practice data.
export const testDraftEnabled =
  hostedPreview && /^\/draft(?:\/|$)/.test(window.location.pathname);
