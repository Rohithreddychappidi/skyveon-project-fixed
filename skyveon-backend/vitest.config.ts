import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // config/env.ts validates these at import time; unit tests never touch
    // a real database or storage bucket.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      JWT_ACCESS_SECRET: "test-access",
      JWT_REFRESH_SECRET: "test-refresh",
      SIGNED_LINK_SECRET: "test-link",
      NODE_ENV: "test",
      UPLOADS_DIR: "/tmp/skyveon-test-uploads",
    },
  },
});
