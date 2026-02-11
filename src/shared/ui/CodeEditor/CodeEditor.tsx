/**
 * CodeEditor - Lightweight syntax-highlighted code editor
 * 
 * Zero-dependency approach: transparent textarea overlaid on a highlighted <pre>.
 * Auto-grows with content up to a max height, then scrolls.
 * Supports HTML and CSS syntax highlighting via regex tokenization.
 */

import React, { useRef, useCallback, useMemo, useEffect } from 'react';

interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    syntax: 'html' | 'css';
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    className?: string;
}

// ============================================================================
// Syntax Highlighting
// ============================================================================

function highlightHTML(code: string): string {
    return code
        // HTML comments
        .replace(/(<!--[\s\S]*?-->)/g, '<span class="ce-comment">$1</span>')
        // Tags (opening and closing)
        .replace(/(&lt;\/?)([\w-]+)/g, '<span class="ce-bracket">$1</span><span class="ce-tag">$2</span>')
        // Closing bracket
        .replace(/(\/?&gt;)/g, '<span class="ce-bracket">$1</span>')
        // Attributes (name="value")
        .replace(/([\w-]+)(=)(&quot;[^&]*&quot;|&#39;[^&]*&#39;)/g,
            '<span class="ce-attr">$1</span><span class="ce-bracket">$2</span><span class="ce-string">$3</span>')
        // Standalone attributes
        .replace(/\s([\w-]+)(?=\s|&gt;|\/&gt;)/g, ' <span class="ce-attr">$1</span>');
}

function highlightCSS(code: string): string {
    return code
        // CSS comments
        .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="ce-comment">$1</span>')
        // Selectors (before {)
        .replace(/^([^{}\n]+?)(\s*\{)/gm, '<span class="ce-tag">$1</span>$2')
        // Property names
        .replace(/([\w-]+)(\s*:)/g, '<span class="ce-attr">$1</span>$2')
        // String values
        .replace(/(&quot;[^&]*&quot;|&#39;[^&]*&#39;)/g, '<span class="ce-string">$1</span>')
        // Numbers with units
        .replace(/\b(\d+\.?\d*)(px|rem|em|%|vh|vw|s|ms|deg|fr)\b/g, '<span class="ce-number">$1$2</span>')
        // Hex colors
        .replace(/(#[0-9a-fA-F]{3,8})\b/g, '<span class="ce-number">$1</span>')
        // CSS functions
        .replace(/\b(var|calc|rgba?|hsla?|linear-gradient|radial-gradient|color-mix|url|min|max|clamp)\(/g,
            '<span class="ce-fn">$1</span>(');
}

function escapeHTML(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function highlight(code: string, syntax: 'html' | 'css'): string {
    const escaped = escapeHTML(code);
    return syntax === 'html' ? highlightHTML(escaped) : highlightCSS(escaped);
}

// ============================================================================
// Component
// ============================================================================

const LINE_HEIGHT_REM = 1.5;
const PADDING_REM = 0.625 * 2; // top + bottom padding

const CodeEditor: React.FC<CodeEditorProps> = ({
    value,
    onChange,
    syntax,
    placeholder,
    rows = 4,
    disabled = false,
    className = '',
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Height constraints based on rows prop
    const minRows = rows;
    const maxRows = Math.max(rows * 3, 20); // grows up to 3x initial, then scrolls

    // Auto-grow: adjust height based on content
    const autoGrow = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Reset to min so scrollHeight recalculates
        textarea.style.height = '0';

        const fontSize = parseFloat(getComputedStyle(textarea).fontSize) || 13;
        const lineHeightPx = LINE_HEIGHT_REM * fontSize;
        const paddingPx = PADDING_REM * fontSize;
        const minPx = minRows * lineHeightPx + paddingPx;
        const maxPx = maxRows * lineHeightPx + paddingPx;

        const contentHeight = Math.min(Math.max(textarea.scrollHeight, minPx), maxPx);
        textarea.style.height = `${contentHeight}px`;
    }, [minRows, maxRows]);

    // Re-grow on value change
    useEffect(() => {
        autoGrow();
    }, [value, autoGrow]);

    // Sync scroll position between textarea and pre
    const handleScroll = useCallback(() => {
        if (textareaRef.current && preRef.current) {
            preRef.current.scrollTop = textareaRef.current.scrollTop;
            preRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    }, []);

    const highlighted = useMemo(() => {
        if (!value) return '';
        return highlight(value, syntax);
    }, [value, syntax]);

    const minHeight = `${minRows * LINE_HEIGHT_REM + PADDING_REM}rem`;

    return (
        <div
            ref={wrapperRef}
            className={`code-editor-wrapper ${className}`}
            style={{ minHeight }}
        >
            {/* Highlighted layer (behind) */}
            <pre
                ref={preRef}
                className="code-editor-highlight"
                aria-hidden="true"
                dangerouslySetInnerHTML={{
                    __html: highlighted + '\n'
                }}
            />

            {/* Editable textarea (in front, transparent text) */}
            <textarea
                ref={textareaRef}
                className="code-editor-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onScroll={handleScroll}
                placeholder={placeholder}
                disabled={disabled}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                data-gramm="false"
            />
        </div>
    );
};

export default CodeEditor;
