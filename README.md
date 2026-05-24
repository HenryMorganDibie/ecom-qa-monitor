# 🛒 Ecom QA Monitor

> **AI-assisted production health monitoring for ecommerce checkout flows, tracking integrity, and subscription systems.**

A lightweight but production-grade tool that continuously validates your ecommerce stack — checkout redirects, pixel firing, subscription webhooks, and analytics integrity — and uses an LLM to generate plain-English incident summaries when things break.

Built to solve a real problem: catching silent failures in checkout flows *before* they cost you revenue.

---

## 🔍 What It Does

| Check | What it validates |
|---|---|
| **Checkout Flow** | HTTP status codes, redirect chains, final landing URL |
| **Tracking Pixels** | Presence of GA4 / Meta Pixel / GTM script tags in page HTML |
| **Webhook Health** | POST to subscription/order webhook endpoints, validates response shape |
| **Redirect Integrity** | Ensures no unexpected 301/302 loops or broken funnel steps |
| **AI Incident Summary** | Feeds all failures to Claude claude-sonnet-4-20250514 → returns a prioritized, plain-English ops report |

---

## 🏗️ Architecture

```
ecom-qa-monitor/
├── src/
│   ├── runner.js          # Orchestrates all checks, collects results
│   ├── checks/
│   │   ├── checkoutFlow.js    # Validates checkout URL chain
│   │   ├── pixelCheck.js      # Scrapes page HTML for tracking scripts
│   │   ├── webhookCheck.js    # Fires test payloads at webhook endpoints
│   │   └── redirectCheck.js   # Follows redirects, detects loops
│   └── ai/
│       └── summarize.js       # Sends failures to Claude for incident report
├── tests/
│   └── unit/              # Jest unit tests for each check module
├── scripts/
│   └── runMonitor.sh      # Local run script with env var loading
├── .github/
│   └── workflows/
│       └── qa-monitor.yml # Runs on push + scheduled (every 30 min)
├── config.example.json    # Template for endpoint configuration
└── package.json
```

---

## ⚡ Quick Start

```bash
git clone https://github.com/HenryMorganDibie/ecom-qa-monitor.git
cd ecom-qa-monitor
npm install
cp config.example.json config.json
# Edit config.json with your store URLs and endpoints
```

Set your environment variables:
```bash
export GROQ_API_KEY=your_key
export WEBHOOK_SECRET=your_webhook_secret
```

Run:
```bash
node src/runner.js
# or
bash scripts/runMonitor.sh
```

---

## 📋 Config

```json
{
  "store": {
    "checkoutUrl": "https://your-store.com/checkout",
    "thankYouUrl": "https://your-store.com/thank-you",
    "productPageUrl": "https://your-store.com/products/your-product"
  },
  "pixels": {
    "ga4MeasurementId": "G-XXXXXXXXXX",
    "metaPixelId": "XXXXXXXXXXXXXXX",
    "gtmContainerId": "GTM-XXXXXXX"
  },
  "webhooks": [
    {
      "name": "Order Created",
      "url": "https://your-store.com/webhooks/orders/create",
      "method": "POST",
      "expectedStatus": 200
    }
  ],
  "redirectChain": [
    "https://your-store.com/buy",
    "https://your-store.com/checkout",
    "https://your-store.com/thank-you"
  ]
}
```

---

## 🤖 AI Incident Summarization

When failures are detected, the monitor compiles all results and calls Claude to generate a structured incident report:

**Sample AI Output:**
```
🚨 INCIDENT SUMMARY — 2025-05-20T14:32:00Z

CRITICAL (1):
- Checkout URL returned 502. Last healthy: 14 minutes ago.
  Likely cause: upstream server error or deploy in progress.
  Recommended action: Check Shopify status page + recent deploys.

WARNING (1):
- Meta Pixel not detected on /thank-you page.
  Likely cause: GTM tag misfiring or conditional trigger issue.
  Recommended action: Inspect GTM container for purchase event trigger.

OK (3): Redirect chain, GA4, webhook endpoint all healthy.
```

This pattern — automated checks + AI triage — means on-call engineers get actionable context immediately, not raw logs.

---

## 🔁 GitHub Actions: Scheduled + Push Monitoring

`.github/workflows/qa-monitor.yml` runs:
- On every push to `main`
- On a schedule: every 30 minutes
- Sends Slack/email alert (configurable) on failure

```yaml
on:
  push:
    branches: [main]
  schedule:
    - cron: '*/30 * * * *'
```

---

## 🧪 Tests

```bash
npm test
```

Unit tests cover each check module with mocked HTTP responses. Integration tests (opt-in) fire against a staging environment.

---

## 💡 Real-World Context

This tool was designed around a class of production failures common in ecommerce:

- **Silent checkout breaks** — checkout loads but payment gateway silently fails; no alert fires
- **Pixel drift** — a deploy removes a `<script>` tag, Meta/GA4 data goes dark for hours before anyone notices
- **Redirect rot** — a URL slug change breaks a paid ad funnel; ROAS tanks before the team catches it
- **Webhook timeouts** — subscription renewal webhooks start timing out; fulfillment queue silently backs up

Traditional uptime monitors (Pingdom, Better Uptime) check if a URL returns 200. They won't catch pixel absence, redirect chain breaks, or webhook payload validation failures. This tool does.

---

## 🛠️ Tech Stack

- **Node.js** — runtime
- **axios** — HTTP requests
- **cheerio** — lightweight HTML parsing for pixel detection
- **Jest** — unit testing
- **GitHub Actions** — CI/CD and scheduled runs
- **Anthropic Claude API** — AI incident summarization
- **dotenv** — local environment management

---

## 📌 Roadmap

- [ ] Shopify-native webhook HMAC validation
- [ ] Checkout Champ endpoint support
- [ ] Slack + PagerDuty alerting integrations
- [ ] Historical run log with SQLite
- [ ] Dashboard UI (React) for monitoring history

---

## Author

**Henry Dibie** — ML Systems Engineer & Ecommerce Infrastructure  
[GitHub](https://github.com/HenryMorganDibie) · [LinkedIn](https://linkedin.com/in/kinghenrymorgan)
