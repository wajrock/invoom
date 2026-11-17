/**
 * Reader of the current theme tokens (styles.css), for canvas drawings that cannot use CSS variables. The page style
 * is read once; take a new reader after a theme change.
 */
export function themeColors(): (token: string) => string {
    const style = getComputedStyle(document.documentElement);
    return (token) => style.getPropertyValue(`--${token}`).trim();
}
