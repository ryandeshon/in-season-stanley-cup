export const hostedPreview =
  process.env.VUE_APP_HOSTED_ARCADE_PREVIEW === 'true';
export const previewEnabled =
  hostedPreview ||
  (process.env.NODE_ENV === 'development' &&
    process.env.VUE_APP_ARCADE_PREVIEW === 'true');
export const previewBase = hostedPreview
  ? `${window.location.origin}/__arcade-preview`
  : 'http://localhost:8091';
