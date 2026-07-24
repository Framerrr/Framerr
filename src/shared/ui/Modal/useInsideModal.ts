import { createContext, useContext } from 'react';

export const InsideModalContext = createContext(false);

/** Returns true when the calling component is rendered inside a <Modal>. */
export function useInsideModal() {
    return useContext(InsideModalContext);
}
