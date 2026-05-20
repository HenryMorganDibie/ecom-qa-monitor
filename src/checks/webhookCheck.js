/**
 * webhookCheck.js
 *
 * Validates webhook endpoint health by sending a test payload
 * and verifying the response status and shape.
 *
 * Covers common ecommerce webhooks:
 *   - Order created / updated
 *   - Subscription renewal
 *   - Fulfillment events
 *
 * NOTE: In production, Shopify webhooks include an HMAC signature header.
 * This check fires a lightweight "ping" payload — full HMAC validation
 * should be added for production use (see Roadmap in README).
 */

const axios = require("axios");

const TIMEOUT_MS = 6000;

/**
 * @param {Array<{name: string, url: string, method: string, payload?: object, expectedStatus: number}>} webhooks
 * @returns {Promise<Array<{check, status, message, meta}>>}
 */
async function checkWebhooks(webhooks) {
  if (!webhooks || webhooks.length === 0) {
    return [
      {
        check: "webhooks",
        status: "warning",
        message: "No webhooks defined in config. Skipping webhook checks.",
      },
    ];
  }

  const results = [];

  for (const webhook of webhooks) {
    const { name, url, method = "POST", payload, expectedStatus = 200 } = webhook;

    const checkName = `webhook:${slugify(name)}`;
    const testPayload = payload || buildDefaultTestPayload(name);

    try {
      const startTime = Date.now();
      const response = await axios({
        method: method.toLowerCase(),
        url,
        data: method.toUpperCase() !== "GET" ? testPayload : undefined,
        timeout: TIMEOUT_MS,
        validateStatus: () => true,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ecom-qa-monitor/1.0 (webhook-check)",
          "X-QA-Monitor": "true", // Allows server to distinguish test pings
        },
      });

      const elapsed = Date.now() - startTime;
      const { status } = response;

      if (status === expectedStatus) {
        results.push({
          check: checkName,
          status: "ok",
          message: `Webhook "${name}" responded with HTTP ${status} in ${elapsed}ms.`,
          meta: { url, httpStatus: status, elapsed },
        });
      } else {
        results.push({
          check: checkName,
          status: "fail",
          message: `Webhook "${name}" returned HTTP ${status} (expected ${expectedStatus}).`,
          meta: { url, httpStatus: status, expectedStatus, elapsed },
        });
      }

      // Warn on slow webhook response — slow webhooks can cause Shopify to retry,
      // leading to duplicate order processing
      if (elapsed > 3000) {
        results.push({
          check: `${checkName}:latency`,
          status: "warning",
          message: `Webhook "${name}" responded slowly: ${elapsed}ms. Shopify times out at 5s and will retry.`,
          meta: { elapsed },
        });
      }
    } catch (err) {
      results.push({
        check: checkName,
        status: "fail",
        message: `Webhook "${name}" unreachable: ${err.message}`,
        meta: { url, error: err.message },
      });
    }
  }

  return results;
}

/**
 * Build a minimal test payload shaped like a Shopify order webhook.
 */
function buildDefaultTestPayload(name) {
  return {
    id: "qa_monitor_test_" + Date.now(),
    test: true,
    source: "ecom-qa-monitor",
    event: name,
    created_at: new Date().toISOString(),
    order: {
      id: "TEST_ORDER_001",
      total_price: "0.00",
      currency: "USD",
      line_items: [],
    },
  };
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

module.exports = { checkWebhooks };
