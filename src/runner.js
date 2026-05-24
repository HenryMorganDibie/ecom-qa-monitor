/**
 * ecom-qa-monitor — Main Runner
 *
 * Orchestrates all ecommerce health checks, collects results,
 * and triggers AI incident summarization when failures are detected.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");

const { checkCheckoutFlow } = require("./checks/checkoutFlow");
const { checkPixels } = require("./checks/pixelCheck");
const { checkWebhooks } = require("./checks/webhookCheck");
const { checkRedirectChain } = require("./checks/redirectCheck");
const { summarizeIncident } = require("./ai/summarize");

// ─────────────────────────────────────────────────────────────
// Config Loading
// ─────────────────────────────────────────────────────────────

function loadConfig() {
  const configArg = process.argv.find((a) => a.startsWith("--config="));
  const configPath = configArg
    ? configArg.split("=")[1]
    : path.join(process.cwd(), "config.json");

  if (!fs.existsSync(configPath)) {
    console.warn(
      `[runner] No config.json found at ${configPath}. Using config.example.json for demo.`
    );
    return require("../config.example.json");
  }

  const raw = fs.readFileSync(configPath, "utf-8");

  if (!raw.trim()) {
    throw new Error("[runner] config.json is empty. Check MONITOR_CONFIG.");
  }

  return JSON.parse(raw);
}

// ─────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────

function formatResultLine(result) {
  const icon =
    result.status === "ok"
      ? "✅"
      : result.status === "warning"
      ? "⚠️"
      : "❌";

  return `  ${icon} [${result.check}] ${result.message}`;
}

// ─────────────────────────────────────────────────────────────
// Main Runner
// ─────────────────────────────────────────────────────────────

async function run() {
  const config = loadConfig();
  const runTimestamp = new Date().toISOString();

  console.log(`\n🔍 ecom-qa-monitor — Run started at ${runTimestamp}`);
  console.log("─".repeat(60));

  const allResults = [];

  // 1. Checkout flow
  console.log("\n[1/4] Checking checkout flow...");
  const checkoutResults = await checkCheckoutFlow(config.store);
  allResults.push(...checkoutResults);

  // 2. Pixels
  console.log("[2/4] Checking tracking pixels...");
  const pixelResults = await checkPixels(config.store, config.pixels);
  allResults.push(...pixelResults);

  // 3. Webhooks
  console.log("[3/4] Checking webhook endpoints...");
  const webhookResults = await checkWebhooks(config.webhooks);
  allResults.push(...webhookResults);

  // 4. Redirect chain
  console.log("[4/4] Checking redirect chain...");
  const redirectResults = await checkRedirectChain(config.redirectChain);
  allResults.push(...redirectResults);

  // ─────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────

  const failures = allResults.filter((r) => r.status === "fail");
  const warnings = allResults.filter((r) => r.status === "warning");
  const passes = allResults.filter((r) => r.status === "ok");

  console.log("\n" + "─".repeat(60));
  console.log("📋 CHECK RESULTS");
  console.log("─".repeat(60));

  allResults.forEach((r) => console.log(formatResultLine(r)));

  console.log("\n" + "─".repeat(60));
  console.log(
    `📊 Summary: ${passes.length} passed · ${warnings.length} warnings · ${failures.length} failed`
  );

  // ─────────────────────────────────────────────────────────────
  // AI Incident Summary
  // ─────────────────────────────────────────────────────────────

  if (failures.length > 0 || warnings.length > 0) {
    console.log("\n🤖 Generating AI incident summary...\n");

    try {
      const summary = await summarizeIncident({
        timestamp: runTimestamp,
        results: allResults,
        failures,
        warnings,
        config,
      });

      console.log("─".repeat(60));
      console.log("🚨 AI INCIDENT REPORT");
      console.log("─".repeat(60));
      console.log(summary);
    } catch (err) {
      console.error("[AI summary] Failed:", err.message);
    }
  } else {
    console.log("\n✅ All systems healthy. No incident report needed.");
  }

  console.log("\n" + "─".repeat(60));
  console.log(`Run complete at ${new Date().toISOString()}\n`);
}

// ─────────────────────────────────────────────────────────────
// SAFE SHUTDOWN (fixes Windows UV_HANDLE_CLOSING crash)
// ─────────────────────────────────────────────────────────────

async function main() {
  await run();
}

main()
  .then(() => {
    setTimeout(() => {
      process.exit(0);
    }, 100); // gives async handles time to close safely
  })
  .catch((err) => {
    console.error("\n[runner] Fatal error:", err);
    process.exit(1);
  });

// Prevent premature exit issues on Windows libuv
process.on("beforeExit", () => {});