import type { NextConfig } from "next";

/**
 * Env validation happens at boot, before the app serves a request, so a
 * missing key fails loudly on startup instead of surfacing as a 500
 * mid-request (§15.5 O5).
 */
import { loadEnv } from "@neurobook/shared";
loadEnv();

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
