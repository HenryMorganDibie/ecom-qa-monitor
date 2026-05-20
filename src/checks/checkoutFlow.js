/**
 * checkoutFlow.js
 *
 * Validates that the main checkout URL:
 *  - Returns a successful HTTP status (200 or 302 redirecting to checkout)
 *  - Is reachable within an acceptable response time
 *  - Does NOT return a 4xx or 5xx error
 *
 * In production this would be extended to validate:
 *  - Payment form presence (Shopify checkout DOM checks via headless browser)
 *  - Session token / cart token in response cookies
 *  - Checkout URL format consistency (no unexpected slug changes)
 */

const axios = require("axios");

const TIMEOUT_MS = 8000;
const ACCEPTABLE_RESPONSE_TIME_MS = 3000;
const ACCEPTABLE_STATUSES = [200, 301, 302, 303];

/**
 * @param {object} storeConfig - { checkoutUrl, thankYouUrl, productPageUrl }
 * @returns {Promise<Array<{check: string, status: 'ok'|'warning'|'fail', message: string}>>}
 */
async function checkCheckoutFlow(storeConfig) {
  const results = [];

  if (!storeConfig?.checkoutUrl) {
    return [
      {
        check: "checkout_flow",
        status: "fail",
        message: "No checkoutUrl defined in config.",
      },
    ];
  }

  const startTime = Date.now();

  try {
    const response = await axios.get(storeConfig.checkoutUrl, {
      timeout: TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: () => true, // Don't throw on any status
      headers: {
        "User-Agent": "ecom-qa-monitor/1.0 (health-check)",
      },
    });

    const elapsed = Date.now() - startTime;
    const { status } = response;

    // Status check
    if (ACCEPTABLE_STATUSES.includes(status)) {
      results.push({
        check: "checkout_flow:status",
        status: "ok",
        message: `Checkout URL returned HTTP ${status}.`,
        meta: { url: storeConfig.checkoutUrl, httpStatus: status },
      });
    } else {
      results.push({
        check: "checkout_flow:status",
        status: "fail",
        message: `Checkout URL returned unexpected HTTP ${status}. Expected 200/3xx.`,
        meta: { url: storeConfig.checkoutUrl, httpStatus: status },
      });
    }

    // Response time check
    if (elapsed > ACCEPTABLE_RESPONSE_TIME_MS) {
      results.push({
        check: "checkout_flow:response_time",
        status: "warning",
        message: `Checkout URL slow: ${elapsed}ms (threshold: ${ACCEPTABLE_RESPONSE_TIME_MS}ms).`,
        meta: { elapsed },
      });
    } else {
      results.push({
        check: "checkout_flow:response_time",
        status: "ok",
        message: `Checkout URL responded in ${elapsed}ms.`,
        meta: { elapsed },
      });
    }

    // Thank you page check
    if (storeConfig.thankYouUrl) {
      const tyResult = await checkSingleUrl(
        storeConfig.thankYouUrl,
        "checkout_flow:thank_you_page"
      );
      results.push(tyResult);
    }
  } catch (err) {
    results.push({
      check: "checkout_flow:status",
      status: "fail",
      message: `Checkout URL unreachable: ${err.message}`,
      meta: { url: storeConfig.checkoutUrl, error: err.message },
    });
  }

  return results;
}

/**
 * Helper: check a single URL for basic reachability.
 */
async function checkSingleUrl(url, checkName) {
  try {
    const response = await axios.get(url, {
      timeout: TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { "User-Agent": "ecom-qa-monitor/1.0 (health-check)" },
    });

    if (response.status >= 200 && response.status < 400) {
      return {
        check: checkName,
        status: "ok",
        message: `${url} returned HTTP ${response.status}.`,
        meta: { url, httpStatus: response.status },
      };
    } else {
      return {
        check: checkName,
        status: "fail",
        message: `${url} returned HTTP ${response.status}.`,
        meta: { url, httpStatus: response.status },
      };
    }
  } catch (err) {
    return {
      check: checkName,
      status: "fail",
      message: `${url} unreachable: ${err.message}`,
      meta: { url, error: err.message },
    };
  }
}

module.exports = { checkCheckoutFlow, checkSingleUrl };
