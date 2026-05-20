/**
 * tests/unit/checkoutFlow.test.js
 *
 * Unit tests for the checkout flow checker.
 * Uses axios-mock-adapter to avoid real HTTP calls.
 */

const axios = require("axios");
const MockAdapter = require("axios-mock-adapter");
const { checkCheckoutFlow } = require("../../src/checks/checkoutFlow");

const mock = new MockAdapter(axios);

afterEach(() => {
  mock.reset();
});

describe("checkCheckoutFlow", () => {
  const storeConfig = {
    checkoutUrl: "https://example-store.com/checkout",
    thankYouUrl: "https://example-store.com/thank-you",
  };

  test("returns ok when checkout URL returns 200", async () => {
    mock.onGet(storeConfig.checkoutUrl).reply(200, "<html>checkout</html>");
    mock.onGet(storeConfig.thankYouUrl).reply(200, "<html>thanks</html>");

    const results = await checkCheckoutFlow(storeConfig);

    const statusResult = results.find((r) => r.check === "checkout_flow:status");
    expect(statusResult.status).toBe("ok");
    expect(statusResult.message).toContain("200");
  });

  test("returns fail when checkout URL returns 502", async () => {
    mock.onGet(storeConfig.checkoutUrl).reply(502);
    mock.onGet(storeConfig.thankYouUrl).reply(200, "<html>thanks</html>");

    const results = await checkCheckoutFlow(storeConfig);

    const statusResult = results.find((r) => r.check === "checkout_flow:status");
    expect(statusResult.status).toBe("fail");
    expect(statusResult.message).toContain("502");
  });

  test("returns fail when checkout URL is unreachable", async () => {
    mock.onGet(storeConfig.checkoutUrl).networkError();

    const results = await checkCheckoutFlow(storeConfig);

    const statusResult = results.find((r) => r.check === "checkout_flow:status");
    expect(statusResult.status).toBe("fail");
    expect(statusResult.message).toContain("unreachable");
  });

  test("returns fail when no checkoutUrl is provided", async () => {
    const results = await checkCheckoutFlow({});

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("fail");
    expect(results[0].message).toContain("No checkoutUrl");
  });

  test("returns ok for 302 redirect on checkout URL", async () => {
    mock.onGet(storeConfig.checkoutUrl).reply(302, "", {
      location: "https://example-store.com/checkout/session",
    });
    mock.onGet(storeConfig.thankYouUrl).reply(200, "<html>thanks</html>");

    const results = await checkCheckoutFlow(storeConfig);

    const statusResult = results.find((r) => r.check === "checkout_flow:status");
    expect(statusResult.status).toBe("ok");
  });
});
