import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')
);

function readGitValue(command) {
  try {
    return execSync(command, {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

const gitCommitCount = readGitValue('git rev-list --count HEAD');
const gitCommitHash = readGitValue('git rev-parse --short HEAD');

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version,
    NEXT_PUBLIC_APP_COMMIT_COUNT: process.env.NEXT_PUBLIC_APP_COMMIT_COUNT || gitCommitCount,
    NEXT_PUBLIC_APP_COMMIT_HASH: process.env.NEXT_PUBLIC_APP_COMMIT_HASH || gitCommitHash,
  },
  turbopack: {
    root: __dirname,
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
