/**
 * pixelCheck.js
 *
 * Scrapes page HTML to verify that critical tracking scripts are present:
 *   - Google Analytics 4 (GA4) measurement ID
 *   - Meta (Facebook) Pixel ID
 *   - Google Tag Manager container ID
 *
 * Silent pixel failures are one of the most costly ecommerce bugs:
 * ad spend continues, but conversion data goes dark, breaking ROAS reporting
 * and any ML models trained on purchase events.
 *
 * Checks both the product page and the thank-you/confirmation page
 * since pixel firing on the confirmation page is what registers conversions.
 */

const axios = require("axios");
const cheerio = require("cheerio");

const TIMEOUT_MS = 10000;

/**
 * @param {object} storeConfig - { productPageUrl, thankYouUrl }
 * @param {object} pixelConfig - { ga4MeasurementId, metaPixelId, gtmContainerId }
 * @returns {Promise<Array<{check, status, message}>>}
 */
async function checkPixels(storeConfig, pixelConfig) {
  const results = [];

  if (!pixelConfig || Object.keys(pixelConfig).length === 0) {
    return [
      {
        check: "pixels",
        status: "warning",
        message: "No pixel config defined. Skipping pixel checks.",
      },
    ];
  }

  const urlsToCheck = [];
  if (storeConfig?.productPageUrl) {
    urlsToCheck.push({
      label: "product_page",
      url: storeConfig.productPageUrl,
    });
  }
  if (storeConfig?.thankYouUrl) {
    urlsToCheck.push({ label: "thank_you_page", url: storeConfig.thankYouUrl });
  }

  if (urlsToCheck.length === 0) {
    return [
      {
        check: "pixels",
        status: "warning",
        message:
          "No productPageUrl or thankYouUrl in config. Skipping pixel checks.",
      },
    ];
  }

  for (const { label, url } of urlsToCheck) {
    let html = "";

    try {
      const response = await axios.get(url, {
        timeout: TIMEOUT_MS,
        validateStatus: () => true,
        headers: { "User-Agent": "ecom-qa-monitor/1.0 (pixel-check)" },
      });

      if (response.status !== 200) {
        results.push({
          check: `pixels:fetch_${label}`,
          status: "fail",
          message: `Could not fetch ${label} for pixel check — HTTP ${response.status}`,
          meta: { url },
        });
        continue;
      }

      html = response.data;
    } catch (err) {
      results.push({
        check: `pixels:fetch_${label}`,
        status: "fail",
        message: `Could not fetch ${label}: ${err.message}`,
        meta: { url },
      });
      continue;
    }

    // ── GA4 Check ────────────────────────────────────────────────────────────
    if (pixelConfig.ga4MeasurementId) {
      const ga4Present = html.includes(pixelConfig.ga4MeasurementId);
      results.push({
        check: `pixels:ga4_${label}`,
        status: ga4Present ? "ok" : "fail",
        message: ga4Present
          ? `GA4 measurement ID (${pixelConfig.ga4MeasurementId}) found on ${label}.`
          : `GA4 measurement ID (${pixelConfig.ga4MeasurementId}) NOT found on ${label}. Conversion tracking may be broken.`,
        meta: { url, pixelType: "ga4", found: ga4Present },
      });
    }

    // ── Meta Pixel Check ─────────────────────────────────────────────────────
    if (pixelConfig.metaPixelId) {
      const metaPresent =
        html.includes(pixelConfig.metaPixelId) ||
        html.includes("connect.facebook.net");
      results.push({
        check: `pixels:meta_pixel_${label}`,
        status: metaPresent ? "ok" : "fail",
        message: metaPresent
          ? `Meta Pixel (${pixelConfig.metaPixelId}) found on ${label}.`
          : `Meta Pixel (${pixelConfig.metaPixelId}) NOT found on ${label}. Facebook ad conversions may not be tracked.`,
        meta: { url, pixelType: "meta", found: metaPresent },
      });
    }

    // ── GTM Check ────────────────────────────────────────────────────────────
    if (pixelConfig.gtmContainerId) {
      const $ = cheerio.load(html);
      const gtmScripts = $("script")
        .toArray()
        .filter((el) => {
          const src = $(el).attr("src") || "";
          const content = $(el).html() || "";
          return (
            src.includes("googletagmanager.com") ||
            content.includes(pixelConfig.gtmContainerId)
          );
        });

      const gtmPresent = gtmScripts.length > 0;
      results.push({
        check: `pixels:gtm_${label}`,
        status: gtmPresent ? "ok" : "fail",
        message: gtmPresent
          ? `GTM container (${pixelConfig.gtmContainerId}) found on ${label}.`
          : `GTM container (${pixelConfig.gtmContainerId}) NOT found on ${label}. All GTM-managed tags may be missing.`,
        meta: { url, pixelType: "gtm", found: gtmPresent },
      });
    }
  }

  return results;
}

module.exports = { checkPixels };
