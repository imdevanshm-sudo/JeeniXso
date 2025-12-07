import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = __dirname;
const fallbackEnvDir = path.resolve(projectRoot, 'env-fallback');

const ensureFallbackEnvDir = () => {
  if (!fs.existsSync(fallbackEnvDir)) {
    fs.mkdirSync(fallbackEnvDir, { recursive: true });
  }
  return fallbackEnvDir;
};

const resolveEnvDir = () => {
  const envLocalPath = path.resolve(projectRoot, '.env.local');
  try {
    fs.accessSync(envLocalPath, fs.constants.R_OK);
    return projectRoot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') {
      console.warn('[vite-config] .env.local is not readable, using fallback env directory');
      return ensureFallbackEnvDir();
    }
    return projectRoot;
  }
};

const safeLoadEnv = (mode: string, envDir: string) => {
  try {
    return loadEnv(mode, envDir, '');
  } catch (error) {
    console.warn('[vite-config] Failed to read env files, falling back to process.env', error);
    return process.env as Record<string, string>;
  }
};

export default defineConfig(({ mode }) => {
    const envDir = resolveEnvDir();
    const env = safeLoadEnv(mode, envDir);
    const withFallback = (value?: string) => (value ?? process.env.GEMINI_API_KEY ?? '');

    return {
      envDir,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(withFallback(env.GEMINI_API_KEY)),
        'process.env.GEMINI_API_KEY': JSON.stringify(withFallback(env.GEMINI_API_KEY)),
        'process.env.NGC_API_KEY': JSON.stringify(env.NGC_API_KEY ?? process.env.NGC_API_KEY ?? ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
