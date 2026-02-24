/**
 * BuildBadge
 * 
 * Renders a channel badge in the sidebar:
 * - "DEV" for local development (npm run dev)
 * - Version string (e.g. "v0.1.7-beta.1") for beta Docker images
 * - Hidden for stable/production builds
 */
import { useBuildInfo } from '../../../api/hooks/useBuildInfo';
import './styles.css';

export function BetaBadge() {
    const { channel, version } = useBuildInfo();

    if (channel === 'stable') return null;

    const label = channel === 'beta' && version ? `v${version}` : 'DEV';
    const title = channel === 'beta'
        ? `Running pre-release beta build v${version}`
        : 'Running in local development mode';

    return (
        <span className="beta-badge" title={title}>
            {label}
        </span>
    );
}
