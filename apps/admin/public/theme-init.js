// Prevent FOUC: apply dark class before first paint
(() => {
  const theme = localStorage.getItem('oryzae_admin_theme');
  if (
    theme === 'dark' ||
    (theme !== 'light' && matchMedia('(prefers-color-scheme:dark)').matches)
  ) {
    document.documentElement.classList.add('dark');
  }
})();
