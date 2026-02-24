// @ts-check
import { themes as prismThemes } from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Framerr',
  tagline: 'A beautiful dashboard for your self-hosted apps',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  // GitHub Pages deployment
  url: 'https://framerrr.github.io',
  baseUrl: '/Framerr/',

  organizationName: 'Framerrr',
  projectName: 'Framerr',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/Framerrr/Framerr/tree/main/docs-site/',
        },
        blog: false, // Disable blog for now
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'dark',
        respectPrefersColorScheme: false,
      },
      navbar: {
        title: 'Framerr',
        logo: {
          alt: 'Framerr',
          src: 'img/framerr-logo.png',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://github.com/Framerrr/Framerr',
            label: 'GitHub',
            position: 'right',
            className: 'header-github-link',
            'aria-label': 'GitHub',
          },
          {
            href: 'https://hub.docker.com/r/pickels23/framerr',
            label: 'Docker Hub',
            position: 'right',
            className: 'header-docker-link',
            'aria-label': 'Docker Hub',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              { label: 'Getting Started', to: '/docs/getting-started/installation' },
              { label: 'Integrations', to: '/docs/integrations' },
              { label: 'Troubleshooting', to: '/docs/troubleshooting/common-issues' },
            ],
          },
          {
            title: 'Community',
            items: [
              { label: 'GitHub', href: 'https://github.com/Framerrr/Framerr' },
              { label: 'Docker Hub', href: 'https://hub.docker.com/r/pickels23/framerr' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Framerr. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'yaml', 'docker'],
      },
    }),
};

export default config;
