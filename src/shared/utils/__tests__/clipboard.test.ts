import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyTextToClipboard } from '../clipboard';

describe('copyTextToClipboard', () => {
    const writeText = vi.fn();
    const execCommand = vi.fn();

    beforeEach(() => {
        writeText.mockReset();
        execCommand.mockReset();
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText },
            configurable: true,
        });
        document.execCommand = execCommand;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uses Clipboard API on secure context', async () => {
        writeText.mockResolvedValue(undefined);
        const ok = await copyTextToClipboard('hello');
        expect(writeText).toHaveBeenCalledWith('hello');
        expect(ok).toBe(true);
        expect(execCommand).not.toHaveBeenCalled();
    });

    it('falls back when writeText rejects', async () => {
        writeText.mockRejectedValue(new Error('denied'));
        execCommand.mockReturnValue(true);
        const ok = await copyTextToClipboard('fallback');
        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(ok).toBe(true);
        expect(document.body.querySelector('textarea')).toBeNull();
    });

    it('skips Clipboard API when not secure context', async () => {
        Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
        execCommand.mockReturnValue(true);
        const ok = await copyTextToClipboard('http-only');
        expect(writeText).not.toHaveBeenCalled();
        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(ok).toBe(true);
    });

    it('returns false when execCommand throws', async () => {
        Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
        execCommand.mockImplementation(() => {
            throw new Error('blocked');
        });
        const ok = await copyTextToClipboard('fail');
        expect(ok).toBe(false);
        expect(document.body.querySelector('textarea')).toBeNull();
    });
});
