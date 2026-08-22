import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
    devIndicators: {
        buildActivity: false,
    },
    turbopack: {},
    webpack: (config) => {
        config.resolve.alias['@'] = path.resolve(process.cwd(), 'src');
        return config;
    },
};

export default nextConfig;
