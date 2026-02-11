import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(dirname, "../..");

const allowedDevOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

if (process.env.DEV_LAN_ORIGIN) {
  allowedDevOrigins.push(process.env.DEV_LAN_ORIGIN);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: repoRoot,
  },
  allowedDevOrigins,
};

export default nextConfig;
