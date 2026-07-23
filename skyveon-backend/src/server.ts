import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Skyveon Learning Hub API listening on http://localhost:${env.PORT}`);
  // eslint-disable-next-line no-console
  console.log(`   Environment: ${env.NODE_ENV} · Storage: ${env.STORAGE_DRIVER}`);
});
