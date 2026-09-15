import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env")) {
  const password = randomBytes(24).toString("hex");
  const demo = randomBytes(18).toString("base64url");
  writeFileSync(
    ".env",
    `DATABASE_URL="postgresql://petish:${password}@127.0.0.1:55432/petish"\nPG_PASSWORD="${password}"\nBETTER_AUTH_URL="http://127.0.0.1:3000"\nBETTER_AUTH_SECRET="${randomBytes(48).toString("base64url")}"\nPETISH_DEMO="true"\nDEMO_PASSWORD="${demo}"\nMAIL_MODE="local"\nSTORAGE_DRIVER="local"\n`,
  );
  mkdirSync(".local", { recursive: true });
  writeFileSync(
    ".local/demo-accounts.json",
    JSON.stringify(
      {
        password: demo,
        emails: [
          "sarah@petish.test",
          "james@petish.test",
          "maya@petish.test",
          "alex@petish.test",
          "sam@petish.test",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "Local configuration created. Demo credentials are in .local/demo-accounts.json.",
  );
} else console.log("Existing .env preserved.");
