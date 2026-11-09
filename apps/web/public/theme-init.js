// Applies the saved theme before the first paint. iOS Safari 26 colours its status bar from the page
// background it sees when the page loads: once Angular starts, it is too late. Keep in sync with ThemeService.
(function () {
    let theme;
    try {
        theme = localStorage.getItem('fh-theme');
    } catch {
        // Storage unavailable: fall back to the system preference.
    }
    if (theme !== 'light' && theme !== 'dark') {
        theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    const color = theme === 'dark' ? '#09090b' : '#ffffff';
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.backgroundColor = color;
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
        meta.content = color;
        meta.removeAttribute('media');
    });
})();
