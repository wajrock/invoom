// Applies the theme chosen in the app (or the device's) before the first paint, so the page never flashes the
// other palette; ThemeService takes over once Angular starts. Keep the key and colours in step with it.
(function () {
    let mode;
    try {
        mode = localStorage.getItem('invoom-theme');
    } catch {
        // Storage unavailable (private browsing): follow the device
    }
    const dark = mode === 'dark' || (mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#121212' : '#f4f4f4';
})();
