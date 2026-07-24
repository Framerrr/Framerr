import { useContext } from 'react';
import WalkthroughContext from './WalkthroughContext';
import type { WalkthroughContextValue } from './types';

export function useWalkthrough(): WalkthroughContextValue | null {
    return useContext(WalkthroughContext);
}
