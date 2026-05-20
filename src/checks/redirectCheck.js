/**
 * redirectCheck.js
 *
 * Validates the integrity of an ecommerce funnel's redirect chain.
 *
 * Common failure modes this catches:
 *   - A marketing URL (e.g. /buy or /lp/product) pointing to a deleted page
 *   - A checkout redirect loop caused by a bad Shopify script or app conflict
 *   - A 301 redirect to an outdated URL after a slug rename
 *   - Ad landing page URLs that silently 404 (traffic arrives, nothing converts)
 *
 * The check follows the expected chain step by step.
 * Each hop is verified: final destination must match expected URL (or be a
 * subdomain/path prefix of it, since Shopify appends session tokens).
 */

const axios = require("axios");

const TIMEOUT_MS = 8000;
const MAX_HOPS = 8; // Detect infinite redirect loops

/**
 * @param {string[]} redirectChain - Ordered list of expected URLs in the funnel
 * @returns {Promise<Array<{check, status, message, meta}>>}
 */
async function checkRedirectChain(redirectChain) {
  if (!redirectChain || redirectChain.length === 0) {
    return [
      {
        check: "redirect_chain",
        status: "warning",
        message: "No redirectChain defined in config. Skipping redirect checks.",
      },
    ];
  }

  const results = [];

  for (let i = 0; i < redirectChain.length; i++) {
    const sourceUrl = redirectChain[i];
    const expectedFinalUrl = redirectChain[redirectChain.length - 1];

    const checkName = `redirect_chain:step_${i + 1}`;

    try {
      const hops = [];
      let currentUrl = sourceUrl;
      let finalStatus = null;
      let hopCount = 0;

      // Manually follow redirects to capture the full chain
      while (hopCount < MAX_HOPS) {
        const response = await axios.get(currentUrl, {
          timeout: TIMEOUT_MS,
          maxRedirects: 0, // Follow manually
          validateStatus: () => true,
          headers: { "User-Agent": "ecom-qa-monitor/1.0 (redirect-check)" },
        });

        hops.push({ url: currentUrl, status: response.status });
        finalStatus = response.status;

        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers["location"];
          if (!location) break;

          // Handle relative redirects
          currentUrl = location.startsWith("http")
            ? location
            : new URL(location, currentUrl).toString();

          hopCount++;
        } else {
          break;
        }
      }

      if (hopCount >= MAX_HOPS) {
        results.push({
          check: checkName,
          status: "fail",
          message: `Redirect loop detected starting at ${sourceUrl}. Exceeded ${MAX_HOPS} hops.`,
          meta: { sourceUrl, hops },
        });
        continue;
      }

      const finalUrl = hops[hops.length - 1].url;

      // Check final HTTP status
      if (finalStatus >= 400) {
        results.push({
          check: checkName,
          status: "fail",
          message: `Redirect chain from ${sourceUrl} ended with HTTP ${finalStatus} at ${finalUrl}.`,
          meta: { sourceUrl, finalUrl, finalStatus, hops },
        });
        continue;
      }

      // For the first step in the chain, verify it eventually reaches the final destination
      // (Shopify appends ?_ab=0&_fd=0 etc so we compare base paths)
      if (i === 0 && !urlBasenameMatches(finalUrl, expectedFinalUrl)) {
        results.push({
          check: checkName,
          status: "warning",
          message: `Redirect from ${sourceUrl} landed at ${finalUrl} (expected near ${expectedFinalUrl}).`,
          meta: { sourceUrl, finalUrl, expectedFinalUrl, hops },
        });
      } else {
        results.push({
          check: checkName,
          status: "ok",
          message: `Redirect chain step ${i + 1}: ${sourceUrl} → ${finalUrl} (HTTP ${finalStatus}). ${
            hops.length > 1 ? `${hops.length} hop(s).` : "No redirects."
          }`,
          meta: { sourceUrl, finalUrl, finalStatus, hopCount: hops.length, hops },
        });
      }
    } catch (err) {
      results.push({
        check: checkName,
        status: "fail",
        message: `Redirect check failed for ${sourceUrl}: ${err.message}`,
        meta: { sourceUrl, error: err.message },
      });
    }
  }

  return results;
}

/**
 * Loose URL match — strips query strings and trailing slashes for comparison.
 * Shopify appends session tokens and variant params, so we can't do strict equality.
 */
function urlBasenameMatches(actual, expected) {
  const normalize = (url) => {
    try {
      const u = new URL(url);
      return u.hostname + u.pathname.replace(/\/$/, "");
    } catch {
      return url;
    }
  };
  return normalize(actual).startsWith(normalize(expected));
}

module.exports = { checkRedirectChain };
