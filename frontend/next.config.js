/** @type {import('next').NextConfig} */
const publicEnv = [
  'NEXT_PUBLIC_NETWORK',
  'NEXT_PUBLIC_SOROBAN_RPC_URL',
  'NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE',
  'NEXT_PUBLIC_REGISTRY_CONTRACT_ID',
  'NEXT_PUBLIC_BOT_NFT_CONTRACT_ID',
  'NEXT_PUBLIC_ACCRUAL_CONTRACT_ID',
  'NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID',
  'NEXT_PUBLIC_TOKEN_CONTRACT_ID',
].reduce((env, key) => {
  env[key] = process.env[key] ?? '';
  return env;
}, {});

const nextConfig = {
  reactStrictMode: true,
  env: publicEnv,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.stellar.org',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'cloudflare-ipfs.com',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
    ],
  },
  webpack: (config) => {
    // Required for @stellar/stellar-sdk in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;
