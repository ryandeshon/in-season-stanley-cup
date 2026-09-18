// Fail closed: a review build must never fall through to the live API.
export async function registerPreviewWorker() {
  if (!('serviceWorker' in navigator))
    throw new Error('This preview requires service worker support.');
  await navigator.serviceWorker.register('/arcade-preview-worker.js', {
    scope: '/',
  });
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise((resolve, reject) => {
      const changed = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          changed
        );
        reject(new Error('Preview could not start. Please reload.'));
      }, 10000);
      navigator.serviceWorker.addEventListener('controllerchange', changed, {
        once: true,
      });
    });
  }
}
