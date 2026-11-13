import { betterAuth } from "better-auth";
import { Pool } from "pg";

const credipiProductionOrigin = "https://v0-credipi-usuarios.vercel.app";

const vercelOrigins = [
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
].filter((origin): origin is string => Boolean(origin));

const developmentOrigins = [
  "http://localhost:3000",
  process.env.V0_RUNTIME_URL,
  process.env.V0_DEV_APP_URL,
  process.env.V0_BUILD_URL,
  process.env.V0_SANDBOX_URL,
].filter((origin): origin is string => Boolean(origin));

const trustedOrigins =
  process.env.NODE_ENV === "development"
    ? developmentOrigins
    : [credipiProductionOrigin, ...vercelOrigins];

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "admin", input: false },
      storeId: { type: "string", required: false, input: false, fieldName: "store_id" },
    },
  },
  emailAndPassword: { enabled: true },
  trustedOrigins,
  baseURL:
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_ENV === "production" ? credipiProductionOrigin : undefined) ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    process.env.V0_RUNTIME_URL,
  ...(process.env.NODE_ENV === "development"
    ? {
        advanced: {
          defaultCookieAttributes: { sameSite: "none" as const, secure: true },
        },
      }
    : {}),
});
