/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/prerequisites',
        'getting-started/installation',
        'getting-started/first-setup',
        'getting-started/docker-compose',
        'getting-started/updating',
      ],
    },
    {
      type: 'category',
      label: 'Configuration',
      collapsed: false,
      items: [
        'configuration/environment-variables',
        'configuration/backups',
        'configuration/multi-user',
      ],
    },
    {
      type: 'category',
      label: 'Features',
      items: [
        'features/dashboard',
        'features/tabs',
        'features/sharing',
        'features/templates',
        'features/notifications',
        'features/metric-history',
      ],
    },
    {
      type: 'category',
      label: 'Integrations',
      collapsed: false,
      link: { type: 'doc', id: 'integrations/index' },
      items: [
        'integrations/plex',
        'integrations/jellyfin',
        'integrations/emby',
        'integrations/sonarr',
        'integrations/radarr',
        'integrations/overseerr',
        'integrations/tautulli',
        'integrations/qbittorrent',
        'integrations/sabnzbd',
        'integrations/glances',
        'integrations/unraid',
        'integrations/uptime-kuma',
        'integrations/framerr-monitor',
        'integrations/custom-system-status',
      ],
    },
    {
      type: 'category',
      label: 'Widgets',
      collapsed: false,
      link: { type: 'doc', id: 'widgets/index' },
      items: [
        'widgets/media-stream',
        'widgets/media-search',
        'widgets/calendar',
        'widgets/sonarr',
        'widgets/radarr',
        'widgets/overseerr',
        'widgets/tautulli',
        'widgets/downloads',
        'widgets/system-status',
        'widgets/service-status',
        'widgets/clock',
        'widgets/weather',
        'widgets/iframe',
        'widgets/link-grid',
        'widgets/custom-html',
      ],
    },
    {
      type: 'category',
      label: 'Customization',
      items: [
        'customization/themes',
        'customization/widgets',
        'customization/css-variables',
        'customization/custom-favicon',
      ],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/common-issues',
        'troubleshooting/networking',
        'troubleshooting/logs-debugging',
      ],
    },
  ],
};

module.exports = sidebars;

