import { viteBundler } from '@vuepress/bundler-vite';
import { defaultTheme } from '@vuepress/theme-default';
import { defineUserConfig } from 'vuepress';

export default defineUserConfig({
    base: '/sdk/docs/',
    bundler: viteBundler(),
    theme: defaultTheme({
        logo: './api/media/images/xeokit_logo.png',
        navbar: [
            {
                text: 'Home',
                link: '/',
            },
            {
                text: 'API',
                link: 'https://xeokit.github.io/sdk/docs/api/',
                target: '_self',
                rel: false,
            },
            {
                text: 'Overview',
                link: '/overview',
            },
            {
                text: 'Quickstart',
                link: '/quickstart',
            },
            {
                text: 'Glossary',
                link: '/glossary',
            },
            {
                text: 'Contributing',
                link: '/contributing',
            },
            {
                text: 'Credits',
                link: '/credits',
            },
        ],
    }),
});
