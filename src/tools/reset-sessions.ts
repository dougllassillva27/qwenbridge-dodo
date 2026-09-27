import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dbPath = path.resolve("data/db/qwenproxy.db");
if (fs.existsSync(dbPath)) {
  const db = new Database(dbPath);
  try {
    const resAccounts = db.prepare("UPDATE accounts SET cooldown_until = NULL, cooldown_reason = NULL").run();
    console.log(`[OK] Cooldowns limpos: ${resAccounts.changes} contas reativadas.`);
  } catch (e: any) {
    console.warn(`[WARN] Erro ao limpar cooldowns:`, e.message);
  }
  try {
    const resSessions = db.prepare("DELETE FROM qwen_auth_sessions").run();
    console.log(`[OK] Sessões expiradas limpas: ${resSessions.changes} sessões removidas.`);
  } catch (e: any) {
    console.warn(`[WARN] Erro ao limpar sessões:`, e.message);
  }
  db.close();
  console.log("✅ Banco de dados resetado para novo login limpo!");
} else {
  console.log("[INFO] Banco de dados ainda não existe.");
}
