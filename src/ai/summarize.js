/**
 * summarize.js
 *
 * Sends collected check results to Claude (claude-sonnet-4-20250514) and returns
 * a structured, plain-English incident report prioritized by severity.
 *
 * This is the AI layer of the QA monitor — instead of raw logs, on-call
 * engineers get an actionable summary with likely causes and next steps.
 */

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * @param {object} ctx
 * @param {string} ctx.timestamp
 * @param {Array} ctx.results
 * @param {Array} ctx.failures
 * @param {Array} ctx.warnings
 * @param {object} ctx.config
 * @returns {Promise<string>} Plain-text incident report
 */
async function summarizeIncident({ timestamp, results, failures, warnings, config }) {
  const prompt = buildPrompt({ timestamp, results, failures, warnings, config });

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].text;
}

function buildPrompt({ timestamp, results, failures, warnings, config }) {
  const failureLines = failures
    .map((r) => `  - [FAIL] ${r.check}: ${r.message}`)
    .join("\n");

  const warningLines = warnings
    .map((r) => `  - [WARN] ${r.check}: ${r.message}`)
    .join("\n");

  const okLines = results
    .filter((r) => r.status === "ok")
    .map((r) => `  - [OK]   ${r.check}: ${r.message}`)
    .join("\n");

  return `You are an ecommerce site reliability engineer reviewing automated health check results for an online store.

Run timestamp: ${timestamp}
Store checkout URL: ${config?.store?.checkoutUrl || "unknown"}

FAILURES (${failures.length}):
${failureLines || "  none"}

WARNINGS (${warnings.length}):
${warningLines || "  none"}

PASSING (${results.filter((r) => r.status === "ok").length}):
${okLines || "  none"}

Write a concise incident report for the on-call engineer. Structure it exactly like this:

🚨 INCIDENT SUMMARY — ${timestamp}

CRITICAL (<count>):
- For each failure: one sentence on what broke, one on the likely cause, one on recommended action.

WARNING (<count>):
- For each warning: one sentence on what is degraded, one on likely cause, one on recommended action.

OK (<count>): List the passing checks in a single comma-separated line.

Keep the tone direct and operational. No fluff. Prioritize by revenue impact.`;
}

module.exports = { summarizeIncident };
