/**
 * tests/unit/webhookCheck.test.js
 */

const axios = require("axios");
const MockAdapter = require("axios-mock-adapter");
const { checkWebhooks } = require("../../src/checks/webhookCheck");

const mock = new MockAdapter(axios);

afterEach(() => {
  mock.reset();
});

const webhooks = [
  {
    name: "Order Created",
    url: "https://example-store.com/webhooks/orders/create",
    method: "POST",
    expectedStatus: 200,
  },
  {
    name: "Subscription Renewal",
    url: "https://example-store.com/webhooks/subscriptions/renew",
    method: "POST",
    expectedStatus: 200,
  },
];

describe("checkWebhooks", () => {
  test("returns ok when all webhooks respond with expected status", async () => {
    webhooks.forEach((wh) => {
      mock.onPost(wh.url).reply(200, { received: true });
    });

    const results = await checkWebhooks(webhooks);

    const failures = results.filter((r) => r.status === "fail");
    expect(failures).toHaveLength(0);
  });

  test("returns fail when webhook returns unexpected status", async () => {
    mock
      .onPost(webhooks[0].url)
      .reply(500, { error: "Internal Server Error" });
    mock.onPost(webhooks[1].url).reply(200, { received: true });

    const results = await checkWebhooks(webhooks);

    const fail = results.find((r) =>
      r.check.includes("order_created") && r.status === "fail"
    );
    expect(fail).toBeTruthy();
    expect(fail.message).toContain("HTTP 500");
  });

  test("returns fail when webhook is unreachable", async () => {
    mock.onPost(webhooks[0].url).networkError();
    mock.onPost(webhooks[1].url).reply(200);

    const results = await checkWebhooks(webhooks);

    const fail = results.find(
      (r) => r.check.includes("order_created") && r.status === "fail"
    );
    expect(fail).toBeTruthy();
    expect(fail.message).toContain("unreachable");
  });

  test("returns warning when no webhooks defined", async () => {
    const results = await checkWebhooks([]);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("warning");
  });

  test("returns warning when webhooks is null", async () => {
    const results = await checkWebhooks(null);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("warning");
  });
});
