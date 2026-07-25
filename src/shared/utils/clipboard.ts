/** Copy text; Clipboard API on secure contexts, offscreen-textarea execCommand fallback on HTTP. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
    if (typeof window !== 'undefined' && window.isSecureContext && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // fall through to execCommand
        }
    }

    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            return document.execCommand('copy');
        } finally {
            document.body.removeChild(textArea);
        }
    } catch {
        return false;
    }
}
