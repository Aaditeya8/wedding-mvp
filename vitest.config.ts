import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Serial: mailer + invites tests share the var/outbox/mail.jsonl fixture
  test: { include: ["tests/unit/**/*.test.ts"], fileParallelism: false },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
