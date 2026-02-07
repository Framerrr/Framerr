/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    safelist: [
        'glass-card',
        'glass-subtle',
        'shadow-deep',
        'shadow-medium',
        'shadow-subtle',
    ],
    theme: {
        extend: {
            colors: {
                // Backgrounds
                'theme-primary': 'var(--bg-primary)',
                'theme-secondary': 'var(--bg-secondary)',
                'theme-tertiary': 'var(--bg-tertiary)',
                'theme-hover': 'var(--bg-hover)',

                // Accents
                'accent': 'var(--accent)',
                'accent-hover': 'var(--accent-hover)',
                'accent-light': 'var(--accent-light)',
                'accent-secondary': 'var(--accent-secondary)',

                // Status Colors
                'success': 'var(--success)',
                'warning': 'var(--warning)',
                'error': 'var(--error)',
                'info': 'var(--info)',
            },
            backgroundColor: {
                'theme-primary': 'var(--bg-primary)',
                'theme-secondary': 'var(--bg-secondary)',
                'theme-tertiary': 'var(--bg-tertiary)',
                'theme-hover': 'var(--bg-hover)',
                'accent': 'var(--accent)',
                'accent-hover': 'var(--accent-hover)',
            },
            borderColor: {
                'theme': 'var(--border)',
                'theme-light': 'var(--border-light)',
                'accent': 'var(--border-accent)',
            },
            textColor: {
                'theme-primary': 'var(--text-primary)',
                'theme-secondary': 'var(--text-secondary)',
                'theme-tertiary': 'var(--text-tertiary)',
            },
            fontFamily: {
                'primary': 'var(--font-primary)',
                'mono': 'var(--font-mono)',
            },
        },
    },
    plugins: [],
}
