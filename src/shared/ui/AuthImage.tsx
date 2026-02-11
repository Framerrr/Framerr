/**
 * AuthImage - Authenticated Image Component
 * 
 * Fetches images via JS fetch() with credentials instead of plain <img src>.
 * This ensures images load correctly behind reverse proxy auth (Authentik, etc.)
 * where browser <img> tag sub-resource requests may not carry auth headers.
 * 
 * Falls back to a provided fallbackSrc (e.g., TMDB CDN) if the authenticated
 * fetch fails.
 */

import { useState, useEffect, useRef, type ImgHTMLAttributes } from 'react';

interface AuthImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    /** Primary source URL - fetched with credentials */
    src: string | null | undefined;
    /** Fallback source URL - used as plain <img src> if auth fetch fails */
    fallbackSrc?: string | null;
    /** Optional callback when both sources fail */
    onAllFailed?: () => void;
}

const AuthImage: React.FC<AuthImageProps> = ({
    src,
    fallbackSrc,
    onAllFailed,
    alt = '',
    ...imgProps
}) => {
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
    const [useFallback, setUseFallback] = useState(false);
    const blobUrlRef = useRef<string | null>(null);
    const mountedRef = useRef(true);

    // Cleanup blob URL on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
            }
        };
    }, []);

    // Fetch image with credentials
    useEffect(() => {
        // Revoke previous blob URL
        if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }

        setResolvedSrc(null);
        setUseFallback(false);

        if (!src) {
            // No primary source - go straight to fallback
            if (fallbackSrc) {
                setUseFallback(true);
            } else {
                onAllFailed?.();
            }
            return;
        }

        // If the src is already an external URL (TMDB CDN), just use it directly
        if (src.startsWith('http://') || src.startsWith('https://')) {
            setResolvedSrc(src);
            return;
        }

        // Fetch local API image with credentials
        fetch(src, { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error(`${res.status}`);
                return res.blob();
            })
            .then(blob => {
                if (!mountedRef.current) return;
                const url = URL.createObjectURL(blob);
                blobUrlRef.current = url;
                setResolvedSrc(url);
            })
            .catch(() => {
                if (!mountedRef.current) return;
                // Auth fetch failed - try fallback (TMDB CDN)
                if (fallbackSrc) {
                    setUseFallback(true);
                } else {
                    onAllFailed?.();
                }
            });
    }, [src, fallbackSrc]);

    const displaySrc = useFallback ? fallbackSrc : resolvedSrc;

    if (!displaySrc) {
        // Still loading or no source available - render nothing (parent handles placeholder)
        return null;
    }

    return (
        <img
            src={displaySrc}
            alt={alt}
            {...imgProps}
        />
    );
};

export default AuthImage;
