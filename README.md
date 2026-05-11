# @runplane/runplane-sdk

Runplane is an execution control layer for AI systems.

It ensures that no protected action executes before it is evaluated and governed.

Runplane does not execute actions.  
Runplane decides whether actions are allowed to execute.

Runplane must sit in the execution path to guarantee enforcement.

---

# Core Principle

Every protected action is intercepted before execution and must receive a decision.

`shield.guard()` blocks execution until Runplane returns a decision.

The SDK is a thin wrapper over the Runplane Guard API:

👉 https://runplane.ai/api/v1/guard

All decisions are made server-side in the Gateway.

The SDK forwards requests and enforces the result locally.

Runplane is gateway-first.

The Gateway is the enforcement boundary.

---

# Architecture

```text
AI Agent
   ↓
shield.guard()
   ↓
Runplane Gateway
   ↓
ALLOW / BLOCK / REQUIRE_APPROVAL
   ↓
Production System
```

---

# Without vs With Runplane

Without Runplane:

```js
await transferFunds(); // executes immediately
```

With Runplane:

```js
await shield.guard(...); // execution enforced before running
```

Runplane sits between your code and execution.

---

# Example

```ts
await shield.guard(
  "transfer_funds",
  "banking-system",
  {
    amount: 50000,
    toAccountId: "user_456"
  },
  async () => {
    return await transferFunds();
  }
);
```

Possible outcomes:

- ALLOW
- BLOCK
- REQUIRE_APPROVAL

---

# Decision Model

Runplane returns one of three decisions.

## ALLOW

The action is permitted and executes immediately.

## BLOCK

The action is prevented by policy and will not execute.

## REQUIRE_APPROVAL

The action is paused until a human approves or denies it.

Policies evaluate:

- action type
- target system
- runtime context
- risk level

before execution proceeds.

---

# SDK Behavior

The SDK enforces the decision returned by Runplane.

## ALLOW

The callback executes normally.

## BLOCK

The callback is not executed.

The SDK throws `ShieldError` with code:

```txt
BLOCKED
```

## REQUIRE_APPROVAL

The SDK pauses execution until a human decision is made.

If approved:
- the callback executes

If denied:
- the SDK throws `ShieldError` with code:

```txt
DENIED
```

---

# Important Concept

A blocked action is not a system failure.

These are valid enforcement outcomes:

- `BLOCK` = policy decision
- `DENIED` = human decision

Errors only represent unexpected operational failures:

- network failures
- timeouts
- invalid configuration
- infrastructure issues

---

# Why Runplane

AI agents and automations can trigger real-world side effects:

- transferring funds
- deleting data
- modifying infrastructure
- sending messages
- changing production systems

Runplane adds a runtime execution control layer before those actions execute.

Use it to:

- Prevent destructive actions
- Require human approval for risky operations
- Enforce policies in real time
- Add a verifiable decision layer before execution
- Create an execution boundary around AI systems

---

# Installation

```bash
npm install @runplane/runplane-sdk
```

---

# Quick Start

## ESM (Recommended)

Add this to `package.json`:

```json
{
  "type": "module"
}
```

Then create `index.js`:

```js
import { Shield } from "@runplane/runplane-sdk";

const shield = new Shield({
  baseUrl: "https://runplane.ai",
  apiKey: process.env.RUNPLANE_API_KEY,
});

async function main() {
  const result = await shield.guard(
    "transfer_funds",
    "banking-system",
    {
      amount: 1000,
      toAccountId: "user_456",
    },
    async () => {
      console.log("Executing transfer...");
      return { success: true };
    }
  );

  console.log("Result:", result);
}

main();
```

---

## CommonJS

```js
const { Shield } = require("@runplane/runplane-sdk");

const shield = new Shield({
  baseUrl: "https://runplane.ai",
  apiKey: process.env.RUNPLANE_API_KEY,
});
```

---

# Get Started

Create an account and get an API key:

👉 https://runplane.ai/auth/sign-up?mode=developer

Includes free trial access and limited free usage for testing.

A valid API key is required.

---

# Set Your API Key

## macOS / Linux

```bash
export RUNPLANE_API_KEY=your_api_key_here
node index.js
```

## Windows CMD

```cmd
set RUNPLANE_API_KEY=your_api_key_here
node index.js
```

## Windows PowerShell

```powershell
$env:RUNPLANE_API_KEY="your_api_key_here"
node index.js
```

---

# What Happens When You Call guard()

## ALLOW

The callback executes immediately.

Expected output:

```txt
Executing transfer...
Result: { success: true }
```

---

## BLOCK

The action is prevented by policy.

The callback never executes.

```js
import { ShieldError } from "@runplane/runplane-sdk";

try {
  await shield.guard(
    "transfer_funds",
    "production",
    {},
    async () => {
      // never executes
    }
  );
} catch (err) {
  if (err instanceof ShieldError && err.code === "BLOCKED") {
    console.log("Action blocked by policy");
  }
}
```

---

## REQUIRE_APPROVAL

The SDK pauses execution until a human decision is made.

Flow:

1. Action sent to Guard API
2. Decision = `REQUIRE_APPROVAL`
3. SDK polls approval endpoint
4. Human approves or denies
5. Execution continues or is prevented

---

# Where Approvals Happen

Pending approvals are reviewed in the Runplane dashboard:

👉 Approvals tab

If your script appears to be waiting, it is likely pending approval.

---

# Outcome Codes

Runplane outcomes are surfaced through `ShieldError`.

## Enforcement Outcomes (Expected)

| Code | Meaning |
|---|---|
| BLOCKED | Action prevented by policy |
| DENIED | Action rejected by human |

---

## Operational Errors (Unexpected)

| Code | Meaning |
|---|---|
| TIMEOUT | Approval process timed out |
| NETWORK_ERROR | API or network failure |
| UNKNOWN | Unexpected failure |

---

# Fail-Closed Behavior

Default:

```js
failMode: "closed"
```

Meaning:

If Runplane cannot return a decision, execution is blocked.

Examples:

- invalid API key
- network failure
- approval timeout
- unreachable Gateway

This is a safety guarantee.

---

# Troubleshooting

## Script appears to be waiting

Most likely:

- Decision = `REQUIRE_APPROVAL`
- Waiting for human approval

Check:

- Runplane Dashboard
- Approvals tab

---

## invalid_key

Possible causes:

- missing API key
- malformed API key
- wrong environment
- expired key

---

## Cannot use import statement outside a module

Your project is likely running CommonJS.

Fix one of these:

- Add `"type": "module"` to `package.json`
- Rename the file to `.mjs`
- Use the CommonJS example with `require()`

---

# API Reference

## guard()

```ts
guard(actionType, target, context, fn): Promise<T>
```

Intercepts an action before execution.

| Parameter | Type | Description |
|---|---|---|
| actionType | string | Canonical action name |
| target | string | Target system identifier |
| context | object | Runtime context for policy evaluation |
| fn | function | Callback to execute if allowed |

---

## decide()

Request a decision without executing a callback.

```ts
const response = await shield.decide({
  actionType: "transfer_funds",
  target: "banking-api",
  context: { amount: 50000 },
});

if (response.decision === "ALLOW") {
  // proceed
}
```

---

# Final Principle

Runplane must sit in the execution path to guarantee enforcement.