# 🛒 Ecom QA Monitor

> **AI-assisted external ecommerce health monitoring for checkout flows, tracking integrity, and webhook endpoint validation.**

A lightweight production-style observability tool that continuously probes ecommerce-facing endpoints (checkout pages, product pages, and webhook URLs), validates tracking pixel presence, and uses a local LLM (via Groq) to generate structured incident summaries when issues are detected.

Built to simulate real-world ecommerce failure detection — including checkout degradation, tracking loss, and endpoint failures.

---

## 🔍 What It Does

| Check                    | What it validates                                                            |
| ------------------------ | ---------------------------------------------------------------------------- |
| **Checkout Flow Probe**  | HTTP status, response time, and accessibility of checkout/cart pages         |
| **Tracking Pixels**      | Detects GA4, Meta Pixel, and GTM presence in HTML                            |
| **Webhook Health Probe** | Sends test requests to configured endpoints and validates responses          |
| **Redirect Integrity**   | Ensures redirect chains behave as expected                                   |
| **AI Incident Summary**  | Uses Llama 3 via Groq to generate structured, plain-English incident reports |

---

## 🏗️ Architecture

```
ecom-qa-monitor/
├── src/
│   ├── runner.js              # Orchestrates all checks + aggregation
│   ├── checks/
│   │   ├── checkoutFlow.js    # Checkout/cart accessibility checks
│   │   ├── pixelCheck.js      # HTML-based tracking detection
│   │   ├── webhookCheck.js    # Endpoint health probes
│   │   └── redirectCheck.js   # Redirect chain validation
│   └── ai/
│       └── summarize.js       # Groq-powered incident summarization
├── tests/
│   └── unit/
├── scripts/
│   └── runMonitor.sh
├── .github/
│   └── workflows/
│       └── qa-monitor.yml
├── config.example.json
└── package.json
```

---

## ⚡ Quick Start

```bash
git clone https://github.com/HenryMorganDibie/ecom-qa-monitor.git
cd ecom-qa-monitor
npm install
cp config.example.json config.json
```

Set environment variables:

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

This project currently supports **external ecommerce endpoint probing (Nike-style targets or similar public pages used for validation/testing).**

```json
{
  "store": {
    "checkoutUrl": "https://www.nike.com/cart",
    "thankYouUrl": "https://www.nike.com",
    "productPageUrl": "https://www.nike.com/t/air-force-1-07-mens-shoes"
  },
  "pixels": {
    "ga4MeasurementId": "G-TEST123456",
    "metaPixelId": "123456789012345",
    "gtmContainerId": "GTM-TEST123"
  },
  "webhooks": [
    {
      "name": "Homepage Probe",
      "url": "https://www.nike.com",
      "method": "GET",
      "expectedStatus": 200
    },
    {
      "name": "Cart Probe",
      "url": "https://www.nike.com/cart",
      "method": "GET",
      "expectedStatus": 200
    }
  ],
  "redirectChain": [
    "https://www.nike.com",
    "https://www.nike.com/cart"
  ]
}
```

---

## 🤖 AI Incident Summarization

When failures or warnings are detected, results are sent to a local LLM (Llama 3.3 70B via Groq) to generate structured incident reports.

### Example Output

```
🚨 INCIDENT SUMMARY — 2026-05-24T16:49:54Z

CRITICAL (5):
- GA4 missing on product page: tracking degradation detected.
- Meta Pixel missing on product page: attribution loss risk.
- GTM container missing: tag injection failure.
- Checkout response slow: potential performance bottleneck.

OK (9):
- Checkout accessible, cart reachable, redirect chain stable.
```

This transforms raw probe results into **actionable operational intelligence**.

---

## 🔁 GitHub Actions: Scheduled Monitoring

Runs automatically:

* On every push to `main`
* Every 30 minutes via cron
* On manual trigger

```yaml
on:
  push:
    branches: [main]
  schedule:
    - cron: "*/30 * * * *"
```

---

## 🧪 Tests

```bash
npm test
```

Unit tests validate each probe module using mocked HTTP responses.

---

## 💡 Real-World Context

This tool simulates real-world ecommerce observability by probing:

* Checkout availability and performance
* Pixel presence (GA4 / Meta / GTM)
* Webhook endpoint responsiveness
* Redirect integrity

Unlike traditional uptime monitoring tools, this system focuses on **business-layer failure detection**, not just HTTP status checks.

---

## 🛠️ Tech Stack

* Node.js
* axios
* cheerio
* Jest
* GitHub Actions
* Groq (LLM inference)
* dotenv

---

## 📌 Roadmap

* [ ] Slack + Discord alerting
* [ ] Historical incident logging (SQLite)
* [ ] Multi-target probe scheduling
* [ ] Failure trend detection
* [ ] Lightweight monitoring dashboard

---

## 👤 Author

**Henry Dibie** — ML Systems Engineer & Ecommerce Infrastructure
GitHub · LinkedIn
