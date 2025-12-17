# AGENTS.md

> Persistent context and working instructions for all agents contributing to this repository.
> This file defines **product intent**, **mental models**, and **operational rules**.

---

## Project Overview

This project is a **personal finance application** focused on **spending planning**, not accounting.

The app helps users decide **how much they can safely spend** per category each month *before* spending, using budgeting logic, bank connectivity, and AI-assisted automation.

Target users:
- Digital nomads
- International users
- Users frustrated with over-complicated finance apps

Core value proposition:
> *Clarity before spending, not regret after.*

---

## Core Mental Model (Non‑Negotiable)

The system is built around four **strictly separated domains**:

1. **Income** → Where money comes from
2. **Budget** → A conscious monthly decision
3. **Expenses** → Money consumed
4. **Savings** → Money intentionally set aside

Rules:
- Savings are **never** expenses
- Income does **not** automatically change the budget
- Past data is immutable

If a feature blurs these boundaries, it is wrong by definition.

---

## Budget Philosophy

- Budgets are **manually defined per month** by the user
- A budget represents *how much the user chooses to spend*, not total income

Income may:
- Be informational only
- Be allocated to savings
- Suggest a future budget adjustment (manual confirmation required)

Income must **never** silently increase spending capacity.

---

## Categories

### Expense Categories

Two types:

**Fixed**
- Fixed monthly amount
- Subtracted first from the budget

**Variable**
- Percentage-based
- Calculated from remaining budget

Category rules:
- Global and persistent
- Never deleted, only deactivated
- Renaming affects future months only

### Savings (Separate Domain)

- Not categories
- Not part of the budget calculation
- Represent intentional allocation of leftover money

---

## Income Handling

- Imported from banks or added manually
- Never assigned to expense categories
- Can be ignored, saved, or used for insight

---

## Savings & Goals

- Savings can be free or goal-based
- Goals have a target amount and progress
- End-of-month leftovers may roll into savings

Nothing is auto-invested or auto-spent.

---

## Pending Transactions

Pending transactions are bank movements that:
- Cannot be confidently categorized
- Are never auto-assigned blindly

AI may suggest; user always confirms.

---

## AI Responsibilities

AI is used **only when it reduces real user effort**.

### Allowed
- Expense categorization suggestions
- Contextual alerts based on spending pace
- Budget and saving insights

### Forbidden
- Silent data modification
- Automatic financial decisions

---

## Multi‑Currency

- Each user has a base currency
- Expenses can be entered in any supported currency
- Store original + converted values

All analytics use base currency.

---

## Dev Environment Tips

- Frontend: Next.js 15
- Backend / DB: TotalumSDK
- Prefer incremental changes over refactors
- Respect existing data invariants

---

## Testing Instructions

- Any logic change must include updated tests
- Budget, income, savings logic must be covered
- Historical data immutability must not be broken

If unsure, add tests.

---

## Pull Request Rules

- Keep PRs scoped and intentional
- No feature that violates the core mental model
- Run linting and tests before merge

---

## Explicit Non‑Goals

This app is **not**:
- An accounting system
- A tax tool
- A net-worth tracker
- A trading platform

---

## Product North Star

If the user understands only one thing:

> “This is how much I can spend.
> This is how I’m doing.
> This is how I can improve.”

Any contribution that does not reinforce this should be questioned.

