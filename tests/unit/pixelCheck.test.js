/**
 * tests/unit/pixelCheck.test.js
 */

const axios = require("axios");
const MockAdapter = require("axios-mock-adapter");
const { checkPixels } = require("../../src/checks/pixelCheck");

const mock = new MockAdapter(axios);

afterEach(() => {
  mock.reset();
});

const storeConfig = {
  productPageUrl: "https://example-store.com/products/supplement",
  thankYouUrl: "https://example-store.com/thank-you",
};

const pixelConfig = {
  ga4MeasurementId: "G-TEST12345",
  metaPixelId: "123456789012345",
  gtmContainerId: "GTM-TEST123",
};

const htmlWithAllPixels = `
<html>
<head>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST12345"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-TEST12345');
  </script>
  <script src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST123"></script>
</head>
<body>
  <script>
    !function(f,b,e,v,n,t,s){fbq('init', '123456789012345');}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
  </script>
</body>
</html>
`;

const htmlMissingPixels = `
<html><head><title>Test</title></head><body><p>No pixels here.</p></body></html>
`;

describe("checkPixels", () => {
  test("returns ok when all pixels present on both pages", async () => {
    mock.onGet(storeConfig.productPageUrl).reply(200, htmlWithAllPixels);
    mock.onGet(storeConfig.thankYouUrl).reply(200, htmlWithAllPixels);

    const results = await checkPixels(storeConfig, pixelConfig);

    const failures = results.filter((r) => r.status === "fail");
    expect(failures).toHaveLength(0);

    const oks = results.filter((r) => r.status === "ok");
    expect(oks.length).toBeGreaterThan(0);
  });

  test("returns fail when GA4 ID missing from page", async () => {
    mock.onGet(storeConfig.productPageUrl).reply(200, htmlMissingPixels);
    mock.onGet(storeConfig.thankYouUrl).reply(200, htmlMissingPixels);

    const results = await checkPixels(storeConfig, pixelConfig);

    const ga4Failures = results.filter(
      (r) => r.check.includes("ga4") && r.status === "fail"
    );
    expect(ga4Failures.length).toBeGreaterThan(0);
    expect(ga4Failures[0].message).toContain("NOT found");
  });

  test("returns fail when page fetch fails", async () => {
    mock.onGet(storeConfig.productPageUrl).reply(404);
    mock.onGet(storeConfig.thankYouUrl).reply(200, htmlWithAllPixels);

    const results = await checkPixels(storeConfig, pixelConfig);

    const fetchFail = results.find((r) =>
      r.check.includes("fetch_product_page")
    );
    expect(fetchFail.status).toBe("fail");
    expect(fetchFail.message).toContain("HTTP 404");
  });

  test("returns warning when no pixel config provided", async () => {
    const results = await checkPixels(storeConfig, {});

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("warning");
  });

  test("returns warning when no store URLs provided", async () => {
    const results = await checkPixels({}, pixelConfig);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("warning");
  });
});
