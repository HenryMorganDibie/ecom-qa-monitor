/**
 * summarize.js
 *
 * Sends collected check results to Groq (Llama 3.3 70B) and returns
 * a structured, plain-English incident report prioritized by severity.
 */

const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Generate incident summary from QA check results
 *
 * @param {object} ctx
 * @param {string} ctx.timestamp
 * @param {Array} ctx.results
 * @param {Array} ctx.failures
 * @param {Array} ctx.warnings
 * @param {object} ctx.config
 * @returns {Promise<string>}
 */
async function summarizeIncident({
  timestamp,
  results,
  failures,
  warnings,
  config,
}) {
  const prompt = buildPrompt({
    timestamp,
    results,
    failures,
    warnings,
    config,
  });

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a senior ecommerce site reliability engineer. Summarize incidents clearly for on-call engineers. Be concise, direct, and prioritize by business impact.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    return response.choices?.[0]?.message?.content || "No summary returned.";
  } catch (error) {
    console.error("[groq] Failed to generate incident summary:", error.message);

    return `
🚨 INCIDENT SUMMARY — ${timestamp}

CRITICAL (${failures.length})
${failures.map((f) => `- ${f.check}: ${f.message}`).join("\n") || "none"}

WARNING (${warnings.length})
${warnings.map((w) => `- ${w.check}: ${w.message}`).join("\n") || "none"}

OK (${results.filter((r) => r.status === "ok").length})
${results
  .filter((r) => r.status === "ok")
  .map((r) => r.check)
  .join(", ") || "none"}

AI summary unavailable — returned fallback report instead.
`;
  }
}

function buildPrompt({ timestamp, results, failures, warnings, config }) {
  const failureLines = failures.length
    ? failures.map((r) => `- [FAIL] ${r.check}: ${r.message}`).join("\n")
    : "none";

  const warningLines = warnings.length
    ? warnings.map((r) => `- [WARN] ${r.check}: ${r.message}`).join("\n")
    : "none";

  const okLines = results.filter((r) => r.status === "ok").length
    ? results
        .filter((r) => r.status === "ok")
        .map((r) => `- [OK] ${r.check}: ${r.message}`)
        .join("\n")
    : "none";

  return `
You are reviewing automated ecommerce QA monitor results.

Run timestamp:
${timestamp}

Store checkout URL:
${config?.store?.checkoutUrl || "unknown"}

FAILURES (${failures.length})
${failureLines}

WARNINGS (${warnings.length})
${warningLines}

PASSING (${results.filter((r) => r.status === "ok").length})
${okLines}

Write a concise incident report using EXACTLY this format:

🚨 INCIDENT SUMMARY — ${timestamp}

CRITICAL (<count>)
- For each failure:
  - what broke
  - likely cause
  - recommended action

WARNING (<count>)
- For each warning:
  - what is degraded
  - likely cause
  - recommended action

OK (<count>)
- one comma-separated list of passing checks

Rules:
- prioritize by revenue impact
- keep tone operational
- no fluff
- be concise
- plain English only
`;
}

module.exports = {
  summarizeIncident,
};