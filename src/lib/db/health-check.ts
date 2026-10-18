import "dotenv/config";
import { checkDatabaseHealth } from "@/lib/db/health";

async function main() {
  const result = await checkDatabaseHealth();
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

void main();
