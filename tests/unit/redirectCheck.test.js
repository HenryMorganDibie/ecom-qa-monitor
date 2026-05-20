/**
 * tests/unit/redirectCheck.test.js
 */

const axios = require("axios");
const MockAdapter = require("axios-mock-adapter");
const { checkRedirectChain } = require("../../src/checks/redirectCheck");

const mock = new MockAdapter(axios);

afterEach(() => {
  mock.reset();
});

describe("checkRedirectChain", () => {
  const chain = [
    "https://example-store.com/buy",
    "https://example-store.com/checkout",
    "https://example-store.com/thank-you",
  ];

  test("returns ok when each URL resolves cleanly", async () => {
    chain.forEach((url) => {
      mock.onGet(url).reply(200, "<html>ok</html>");
    });

    const results = await checkRedirectChain(chain);

    const failures = results.filter((r) => r.status === "fail");
    expect(failures).toHaveLength(0);
  });

  test("returns fail when a URL in the chain 404s", async () => {
    mock.onGet(chain[0]).reply(404);
    mock.onGet(chain[1]).reply(200);
    mock.onGet(chain[2]).reply(200);

    const results = await checkRedirectChain(chain);

    const fail = results.find(
      (r) => r.check === "redirect_chain:step_1" && r.status === "fail"
    );
    expect(fail).toBeTruthy();
    expect(fail.message).toContain("404");
  });

  test("returns fail when URL is unreachable", async () => {
    mock.onGet(chain[0]).networkError();

    const results = await checkRedirectChain(chain);

    const fail = results.find(
      (r) => r.check === "redirect_chain:step_1" && r.status === "fail"
    );
    expect(fail).toBeTruthy();
  });

  test("returns warning when no redirectChain defined", async () => {
    const results = await checkRedirectChain([]);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("warning");
  });

  test("returns warning when redirectChain is null", async () => {
    const results = await checkRedirectChain(null);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("warning");
  });

  test("follows a 301 redirect correctly", async () => {
    mock.onGet(chain[0]).reply(301, "", {
      location: chain[1],
    });
    mock.onGet(chain[1]).reply(200, "<html>checkout</html>");
    mock.onGet(chain[2]).reply(200, "<html>thanks</html>");

    const results = await checkRedirectChain(chain);

    const step1 = results.find((r) => r.check === "redirect_chain:step_1");
    expect(step1).toBeTruthy();
    // Should not be a hard fail — redirect resolved successfully
    expect(step1.status).not.toBe("fail");
  });
});
