import React from 'react';
import { MobileTabBarEditor } from '../sections/MobileTabBarEditor';
import { SettingsPage } from '@/shared/ui/settings';

export function TabBarPage(): React.JSX.Element {
    return (
        <SettingsPage
            title="Mobile Tab Bar"
            description="Customize the bottom navigation on phones and tablets"
        >
            <MobileTabBarEditor />
        </SettingsPage>
    );
}
