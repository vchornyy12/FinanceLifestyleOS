# Product Requirements Document (PRD)

## Document Information
- **Product Name**: Finance Lifestyle OS
- **Version**: 1.0
- **Date**: 2026-03-31
- **Author**: **[NEEDS CLARIFICATION: Author name not provided]**
- **Status**: Accepted
- **Stakeholders**: **[NEEDS CLARIFICATION: Stakeholder names/roles not provided]**

---

## Executive Summary

Finance Lifestyle OS is an intelligent financial lifestyle management platform designed to go beyond traditional expense tracking. It merges financial planning with health-impact analysis through maximum automation, delivering an ecosystem where managing money feels effortless rather than burdensome.

The platform addresses a core problem: user inertia. Most finance apps fail because they require too much manual effort to maintain. Finance Lifestyle OS solves this by using AI-powered OCR (Claude 3.5 Sonnet) to extract line-item data from paper receipts and store screenshots, and Open Banking (PSD2) to automatically pull bank transactions — eliminating nearly all manual data entry.

The result is a product that gives users SKU-level spending analytics, health vs. wealth insights (e.g., "you spent 240 PLN on sugary drinks this month"), an AI Financial Coach offering proactive advice, and a "Pro" mode with net worth tracking and investment forecasting. The platform will be available as a Next.js web app and a React Native mobile app, sharing a Supabase backend, with a phased rollout across five distinct phases.

---

## 1. Problem Statement

### 1.1 Background

Personal finance apps exist in abundance, yet the majority of people fail to maintain consistent financial tracking. The fundamental barrier is not motivation — it is friction. Users must manually enter every transaction, categorize every expense, and remember to do so consistently. The result is that apps get abandoned within weeks of download.

### 1.2 Problem Description

Current personal finance tools suffer from three critical failures:
1. **High friction data entry** — manual logging is tedious and unsustainable
2. **Shallow analytics** — category-level summaries (e.g., "Food: 800 PLN") tell users nothing actionable about their specific purchasing habits
3. **Disconnected lifestyle view** — no existing tool connects financial spending to health outcomes, missing a critical motivational lever

### 1.3 Who Has This Problem?

- **Primary Users**: Working adults (25–45) in Poland who want to manage their finances but struggle to maintain discipline with existing tools
- **Secondary Users**: Health-conscious individuals who want to understand the financial cost of their dietary habits
- **User Pain Points**:
  - Forgetting to log purchases immediately after making them
  - No visibility into SKU-level spending patterns (e.g., specific products, not just categories)
  - Bank statements provide transaction amounts but not itemized purchase details
  - No connection between spending habits and health/lifestyle impact

### 1.4 Impact of Not Solving

Users continue with a blurred picture of their finances, repeating the same unexamined habits — overspending on low-value items, accumulating lifestyle-driven health costs, and failing to build wealth systematically. The market opportunity for an automated, intelligent approach remains untapped.

---

## 2. Goals and Objectives

### 2.1 Business Goals
- Launch a working MVP (Phase 1) with core data entry and sync capabilities within the first development cycle
- Achieve product-market fit by demonstrating that AI-powered receipt parsing (Phase 2) reduces manual entry to near zero
- Build a defensible platform by Phase 4 that combines financial data, AI coaching, and health analytics in a way competitors cannot replicate quickly

### 2.2 User Goals
- Capture every purchase with minimal effort (ideally one photo or zero action via bank sync)
- Understand their spending at the product level, not just the category level
- Receive actionable, personalized advice that connects their spending habits to their financial and health outcomes
- Track net worth and investments in a single unified dashboard (Pro mode)

### 2.3 Success Metrics

| Metric | Current State | Target | Measurement Method |
|--------|---------------|--------|-------------------|
| Data entry friction | Manual entry required for all transactions | < 20% of transactions require manual entry by Phase 3 | % of transactions auto-captured (OCR + banking) |
| 30-day user retention | N/A (new product) | ≥ 40% by end of Phase 2 | Supabase analytics |
| Receipt parsing accuracy | N/A | ≥ 90% line-item accuracy | QA sampling of parsed receipts |
| Monthly Active Users | 0 | **[NEEDS CLARIFICATION: Target MAU not defined in requirements]** | Supabase analytics |
| User-reported savings insights | N/A | ≥ 60% of users act on at least one AI Coach recommendation per month | In-app survey / action tracking |

### 2.4 Non-Goals
- This product does NOT include tax filing or tax optimization features (Phase 1–5 scope)
- This product does NOT provide regulated financial advice or investment recommendations with fiduciary responsibility
- This product does NOT support banks outside Poland in Phase 3 (international expansion is future scope)
- This product does NOT replace a full accounting system for businesses — personal finance only

---

## 3. User Stories and Use Cases

### 3.1 User Personas

**Persona 1: Marta — The Busy Professional**
- Demographics: 32 years old, marketing manager, Warsaw
- Goals: Wants to save more money without spending time tracking every expense; curious about where her money actually goes
- Frustrations: Has tried 3 finance apps, abandoned each after 2 weeks due to manual logging burden; bank statements are too vague
- Tech proficiency: High

**Persona 2: Tomasz — The Health-Conscious Optimizer**
- Demographics: 28 years old, software engineer, Kraków
- Goals: Wants to understand the full cost of his lifestyle choices, including what unhealthy food spending adds up to; tracking investments
- Frustrations: No single app connects grocery spending detail with health context; investment tracking is siloed from daily spending
- Tech proficiency: High

**Persona 3: Kasia — The Budget-Conscious Parent**
- Demographics: 40 years old, teacher, Gdańsk; family of 4
- Goals: Control household grocery spending, understand price changes in regular purchases, visualize free cash flow after bills
- Frustrations: Price inflation is hard to spot without historical item-level data; budgeting apps don't track individual product prices over time
- Tech proficiency: Medium

### 3.2 User Stories

**Epic 1: Automated Receipt Capture**
- As a user, I want to photograph a paper receipt and have it automatically parsed, so that I don't have to manually enter each item
  - Acceptance Criteria:
    - [ ] User can upload a photo or screenshot of a receipt from the mobile app or web
    - [ ] Claude 3.5 Sonnet extracts store name, date, individual line items (name, quantity, price), and total
    - [ ] Items are automatically mapped to categories (e.g., "Chleb Żytni" → "Bread/Groceries")
    - [ ] User can review and correct the parsed output before saving
    - [ ] Parsed data is synced to Supabase and visible on both web and mobile within 5 seconds

**Epic 2: Open Banking Sync**
- As a user, I want to connect my PKO BP bank account, so that transactions are imported automatically without me logging anything
  - Acceptance Criteria:
    - [ ] User can authenticate with their bank via PSD2 (GoCardless/Salt Edge) OAuth flow
    - [ ] Transactions are fetched and stored automatically on a recurring schedule
    - [ ] Bank transactions are reconciled against receipt data where possible
    - [ ] User receives a notification when new transactions are imported

**Epic 3: Spending Analytics**
- As a user, I want to see how much I spent on specific products over time, so that I can identify patterns and make better purchasing decisions
  - Acceptance Criteria:
    - [ ] Dashboard shows spending by category and by individual product/SKU
    - [ ] Period-over-period comparisons available (month vs. prior month, year vs. prior year)
    - [ ] Anomaly detection flags unusual price increases on regularly purchased items
    - [ ] "Health vs. Wealth" view labels products as Healthy / Neutral / Harmful with a financial cost summary

**Epic 4: AI Financial Coach**
- As a user, I want to receive proactive advice based on my spending patterns, so that I can take concrete steps to improve my financial situation
  - Acceptance Criteria:
    - [ ] AI Coach surfaces at least one actionable insight per week based on the user's data
    - [ ] Insights are personalized (e.g., "Reducing food delivery by 20% frees up 150 PLN/month toward your debt")
    - [ ] User can dismiss, save, or act on each insight

**Epic 5: Pro Mode — Net Worth & Investments**
- As a power user, I want to track all my assets, liabilities, and investments in one place, so that I have a complete picture of my financial health
  - Acceptance Criteria:
    - [ ] User can add assets (cash, deposits, real estate, vehicles) and liabilities (loans, debts)
    - [ ] Net worth is calculated and displayed in real time
    - [ ] Investment portfolio can be tracked via API or manual entry (crypto, stocks)
    - [ ] Compound interest calculator supports 5, 10, and 20-year projections
    - [ ] Free Cash Flow visualization shows income minus all obligations and bills

### 3.3 Use Cases

**Use Case 1: Receipt Capture at Point of Purchase**
- Actor: Marta (primary user, mobile)
- Preconditions: User is authenticated; has just made a purchase at Lidl
- Main Flow:
  1. App sends push notification: "You just spent 87 PLN at Lidl. Snap a photo of the receipt now."
  2. User opens app and taps the camera shortcut
  3. User photographs the receipt
  4. Claude 3.5 parses the receipt and returns itemized results
  5. User reviews the parsed items (30 seconds), makes one correction
  6. User confirms — data saved and synced
- Alternative Flows: User uploads a screenshot from the Lidl app instead of a physical receipt
- Postconditions: All line items stored in Supabase, visible on web dashboard

**Use Case 2: Monthly Health vs. Wealth Review**
- Actor: Tomasz
- Preconditions: At least 30 days of receipt/transaction data captured
- Main Flow:
  1. User navigates to Analytics → Health vs. Wealth
  2. System displays total spending on Healthy / Neutral / Harmful categories
  3. User drills into "Harmful" to see breakdown by product (e.g., energy drinks: 180 PLN, alcohol: 340 PLN)
  4. AI Coach shows insight: "Your alcohol spending over 12 months equals one month's rent"
  5. User saves the insight to their Goals section
- Postconditions: User has a clear view of lifestyle-driven financial costs

---

## 4. Functional Requirements

### 4.1 Core Features

**Feature 1: AI-Powered Receipt OCR**
- Priority: Must Have (Phase 2)
- Description: Users upload photos or screenshots of receipts; Claude 3.5 Sonnet extracts all line items with prices, quantities, and store metadata
- Requirements:
  - Support paper receipt photos and digital screenshots (Biedronka, Żabka, Lidl, and other major Polish retailers)
  - Extract: store name, date/time, individual product names, quantities, unit prices, total
  - Automatically map extracted items to a predefined category taxonomy
  - Provide a user-editable review interface before saving
  - Confidence scoring — low-confidence extractions flagged for user review

**Feature 2: Cross-Platform Real-Time Sync**
- Priority: Must Have (Phase 1)
- Description: All user data is instantly synchronized between the Next.js web app and React Native mobile app via Supabase real-time subscriptions
- Requirements:
  - Any change on one platform reflects on the other within 5 seconds
  - Offline mode: captures are queued locally and synced on reconnection
  - Conflict resolution strategy defined for concurrent edits

**Feature 3: Open Banking Integration**
- Priority: Must Have (Phase 3)
- Description: PSD2-compliant connection to Polish banks (starting with PKO BP) via GoCardless or Salt Edge
- Requirements:
  - OAuth-based bank authentication flow
  - Automatic transaction polling (daily minimum, configurable)
  - Transaction categorization using existing category taxonomy
  - Receipt-to-transaction reconciliation (match OCR data to bank transaction)

**Feature 4: SKU-Level Analytics Dashboard**
- Priority: Must Have (Phase 4)
- Description: Granular analytics showing spending at the individual product level, not just category level
- Requirements:
  - Search and filter by product name across all receipts
  - Time-series chart of price and quantity for any product
  - MoM and YoY comparisons for categories and products
  - Anomaly detection: alert when a product's price exceeds historical average by configurable threshold

**Feature 5: Health vs. Wealth Analysis**
- Priority: Should Have (Phase 5)
- Description: Products labeled by health impact; financial cost of habits surfaced prominently
- Requirements:
  - Product health labeling: Healthy / Neutral / Harmful (editable by user, seeded by category defaults)
  - "Financial Cost of Habits" report: annual spend on sugar, alcohol, tobacco, junk food
  - AI-generated narrative comparing habit costs to financial goals

**Feature 6: Pro Mode — Net Worth & Investment Hub**
- Priority: Should Have (Phase 4)
- Description: Advanced financial dashboard for assets, liabilities, investments, and cash flow modeling
- Requirements:
  - Manual asset/liability entry (cash, real estate, vehicles, loans)
  - Investment tracking via API (crypto: CoinGecko or similar; stocks: **[NEEDS CLARIFICATION: specific stock API not defined]**)
  - Manual investment entry fallback
  - Compound interest calculator: inputs (principal, rate, frequency), outputs for 5/10/20-year horizons
  - Free Cash Flow view: income minus recurring obligations and bills

**Feature 7: AI Financial Coach**
- Priority: Should Have (Phase 4)
- Description: Proactive, personalized financial insights powered by Claude AI
- Requirements:
  - Weekly analysis of spending patterns to generate actionable recommendations
  - Recommendations reference user's actual data and goals
  - User can accept, dismiss, or save recommendations
  - Recommendations respect user's stated goals (e.g., debt payoff, saving target)

**Feature 8: Motivation & Anti-Lazy UX**
- Priority: Nice to Have (Phase 5)
- Description: Push notifications and nudges that prompt timely receipt capture
- Requirements:
  - Post-purchase notification triggered by bank transaction detection: "You just spent X at Y. Snap a receipt."
  - Configurable notification preferences
  - Streak tracking for consistent data entry

### 4.2 User Interface Requirements
- "Clean UI" philosophy — advanced Pro mode features must not clutter the primary one-tap data entry experience
- Mobile-first design for receipt capture; web-optimized for analytics dashboards
- "One-tap" camera shortcut accessible from the mobile home screen
- Progressive disclosure: standard mode (capture + overview) vs. Pro mode (investments, net worth, forecasting)

### 4.3 Business Logic Requirements
- Category taxonomy must be extensible — users can create custom categories
- Item-to-category mapping rules managed by AI with user override capability
- Health labels default to category level but can be overridden per product by the user
- Free Cash Flow = Total Income − Fixed Obligations − Recurring Bills − Discretionary Spending

### 4.4 Data Requirements
- Data captured: store metadata, receipt line items (product name, quantity, unit price, total), transaction date, payment method, bank transactions, asset/liability values, investment positions
- Data validation: monetary values must be positive numerics; dates validated against recognized formats; duplicates detected before saving
- Data retention: **[NEEDS CLARIFICATION: Retention policy (GDPR requirements for EU users) not specified]**

---

## 5. Technical Requirements

### 5.1 System Architecture
Monorepo architecture managed by Turbo + pnpm workspaces:
- `apps/web` — Next.js 16 web application (App Router)
- `apps/mobile` — React Native (Expo) mobile application
- `packages/` — Shared business logic, types, and utilities
- `supabase/` — Database schema, migrations, Edge Functions

All client apps connect to a shared Supabase backend. AI processing (OCR, coaching) invoked via Supabase Edge Functions calling the Anthropic API. Banking data fetched via GoCardless/Salt Edge server-side only (API keys never exposed to clients).

### 5.2 Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Frontend Web | Next.js 16 (Netlify) | Performance, SEO-readiness, rapid deployment |
| Mobile App | React Native (Expo) | Unified iOS/Android codebase; camera and push notification access |
| Backend / DB | Supabase (PostgreSQL) | PostgreSQL + Auth + Real-time sync out of the box |
| AI Engine | Claude 3.5 Sonnet (Anthropic API) | State-of-the-art vision for complex receipt parsing |
| Banking API | GoCardless / Salt Edge | Regulated PSD2-compliant access to EU/Polish banking data |
| Deployment | Netlify (web), EAS (mobile) | Streamlined CI/CD for both platforms |

### 5.3 Performance Requirements
- Receipt parsing response time: < 10 seconds end-to-end (upload → parsed results displayed)
- Real-time sync latency: < 5 seconds between platforms
- Dashboard load time: < 2 seconds for standard analytics view
- API response time: < 500ms for non-AI endpoints
- Uptime: 99.5% availability (MVP); 99.9% post-Phase 3

### 5.4 Security Requirements
- Authentication: Supabase Auth with biometric (FaceID/TouchID) on mobile, 2FA for all users
- Authorization: Row-Level Security (RLS) in Supabase — users can only access their own data
- Data encryption: At-rest (Supabase default AES-256); In-transit (TLS 1.2+)
- Compliance: GDPR compliance required — user data deletion, data export, consent management
- API keys: Banking API credentials stored as Supabase Edge Function secrets, never in client code
- Receipt images: Stored in private Supabase Storage buckets; not publicly accessible

### 5.5 Integration Requirements

| Integration | Purpose | Type | Priority |
|-------------|---------|------|----------|
| Anthropic API (Claude 3.5) | Receipt OCR, AI coaching | REST API via Edge Function | High |
| GoCardless / Salt Edge | PSD2 bank transaction fetch | REST API via Edge Function | High |
| CoinGecko (or equivalent) | Crypto portfolio pricing | REST API | Medium |
| Stock market API | Investment portfolio pricing | REST API | Medium |
| Push notifications | Anti-lazy UX nudges | Expo Push / FCM / APNs | Medium |

### 5.6 Technical Constraints
- Tailwind CSS v4 is used — config is CSS-in-CSS (`globals.css`), no `tailwind.config.js`
- ESLint 9 flat config (`eslint.config.mjs`)
- Must use `pnpm` as package manager — `npm` and `yarn` are not permitted
- Mobile camera access via Expo Camera API
- PSD2 banking integration requires GoCardless/Salt Edge account with EU regulatory approval

---

## 6. Design and User Experience

### 6.1 Design Principles
- **Minimum Effort, Maximum Insight**: Every interaction should require as few taps as possible; AI handles complexity behind the scenes
- **Progressive Disclosure**: Standard users see a clean, simple interface; Pro features revealed only when opted into
- **Honesty in Data**: Analytics present real numbers without flattering distortions — the app should be a trusted mirror, not a motivational poster

### 6.2 User Flows

**Flow 1: Receipt Capture (Mobile)**
1. User makes a purchase → receives push notification
2. User taps notification → app opens to camera
3. User photographs receipt → AI parses in background
4. Review screen shows parsed items → user corrects if needed
5. Confirm → data saved and synced

**Flow 2: Analytics Review (Web)**
1. User logs in → Dashboard shows spending summary
2. User selects time period and category
3. Drill-down to SKU-level view for a specific product
4. View price history chart with anomaly flags
5. AI Coach card surfaces relevant insight

**Flow 3: Bank Account Connection**
1. User navigates to Settings → Connected Accounts
2. Selects bank (PKO BP)
3. Redirected to bank OAuth flow → authenticates
4. Returns to app → transactions begin syncing
5. Notification confirms successful connection

### 6.3 Accessibility Requirements
- WCAG compliance level: AA
- Keyboard navigation: Full support on web
- Screen reader support: Semantic HTML and ARIA labels required
- Color contrast: Minimum 4.5:1 ratio for all text

### 6.4 Responsive Design
- Supported devices: Desktop (web), Tablet (web + mobile), Mobile (primary)
- Mobile is the primary capture interface; web is the primary analytics interface

---

## 7. Dependencies and Assumptions

### 7.1 Dependencies
- **Anthropic API access**: Receipt OCR and AI coaching are blocked without an active Anthropic API key and sufficient quota
- **GoCardless / Salt Edge account**: Open Banking integration requires regulatory approval and provider onboarding — can take 2–4 weeks
- **Supabase project setup**: All backend features (auth, database, storage, edge functions) depend on Supabase project being provisioned
- **Expo EAS account**: Mobile app distribution and OTA updates require EAS setup

### 7.2 Assumptions
- Target market is Polish users (PLN currency, Polish bank coverage, Polish retail receipt formats)
- Users have smartphones with camera capability for receipt capture
- Claude 3.5 Sonnet can reliably parse Polish-language receipts from major Polish retailers (Biedronka, Żabka, Lidl, Kaufland, etc.)
- GoCardless or Salt Edge provides sufficient coverage for PKO BP and other major Polish banks
- Users are willing to grant PSD2 bank access in exchange for automated transaction sync

### 7.3 Risks and Mitigation

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| AI OCR accuracy below 90% for Polish receipts | Medium | High | Build robust user correction flow; fine-tune prompts with real receipt samples during Phase 2 |
| GoCardless/Salt Edge onboarding delays | Medium | High | Begin regulatory onboarding early in Phase 2; Salt Edge as fallback provider |
| User resistance to granting bank access | High | Medium | Make Open Banking opt-in; lead with OCR value first (Phase 2 before Phase 3) |
| GDPR compliance gaps | Low | High | Engage legal counsel before Phase 3 (when banking data is processed); implement data deletion and export from Phase 1 |
| React Native/Expo performance on older devices | Low | Medium | Test on low-end Android devices during Phase 1; optimize rendering early |
| Anthropic API cost at scale | Medium | Medium | Cache AI responses where possible; batch processing for non-real-time coaching insights |

---

## 8. Timeline and Milestones

### 8.1 Project Phases

**Phase 1: Foundation (MVP)**
- Duration: **[NEEDS CLARIFICATION: Specific timelines not defined in requirements]**
- Key Deliverables:
  - User authentication (Supabase Auth, email + password, biometric on mobile)
  - Manual expense entry (web + mobile)
  - Basic category management
  - Real-time sync between web and mobile
  - Supabase database schema (users, transactions, receipts, categories)
  - Offline capture queue with background sync
- Success Criteria: User can create an account, manually log a transaction on mobile, and see it reflected on web within 5 seconds

**Phase 2: AI Magic**
- Duration: **[NEEDS CLARIFICATION]**
- Key Deliverables:
  - Receipt photo upload on mobile
  - Claude 3.5 Sonnet integration via Supabase Edge Function
  - Line-item extraction and category mapping
  - User review/correction interface
  - Support for major Polish retailer receipt formats
- Success Criteria: ≥ 90% line-item extraction accuracy on a test set of 100 receipts

**Phase 3: Banking**
- Duration: **[NEEDS CLARIFICATION]**
- Key Deliverables:
  - GoCardless / Salt Edge integration
  - PKO BP OAuth connection flow
  - Automated transaction polling and storage
  - Receipt-to-bank-transaction reconciliation
  - Anti-lazy UX push notifications post-transaction
- Success Criteria: Users can connect PKO BP and have transactions auto-imported within 24 hours of occurrence

**Phase 4: Pro & Analytics**
- Duration: **[NEEDS CLARIFICATION]**
- Key Deliverables:
  - SKU-level analytics dashboard (web)
  - MoM/YoY trend analysis and anomaly detection
  - Net Worth Tracker (assets + liabilities)
  - Investment Hub (manual + API)
  - Compound interest calculator
  - Free Cash Flow visualization
  - AI Financial Coach (weekly insights)
- Success Criteria: ≥ 60% of active users engage with at least one AI Coach recommendation per month

**Phase 5: Gamification & Health**
- Duration: **[NEEDS CLARIFICATION]**
- Key Deliverables:
  - Health vs. Wealth labeling and reporting
  - Financial Cost of Habits report
  - Streak and motivation system
  - Advanced nudge notification system
- Success Criteria: 30-day retention improves by ≥ 15% compared to Phase 4 baseline

### 8.2 Timeline

| Milestone | Target Date | Owner | Status |
|-----------|-------------|-------|--------|
| Phase 1 MVP complete | **[NEEDS CLARIFICATION]** | **[NEEDS CLARIFICATION]** | Not Started |
| Phase 2 AI OCR live | **[NEEDS CLARIFICATION]** | **[NEEDS CLARIFICATION]** | Not Started |
| Phase 3 Banking integration | **[NEEDS CLARIFICATION]** | **[NEEDS CLARIFICATION]** | Not Started |
| Phase 4 Pro & Analytics | **[NEEDS CLARIFICATION]** | **[NEEDS CLARIFICATION]** | Not Started |
| Phase 5 Gamification | **[NEEDS CLARIFICATION]** | **[NEEDS CLARIFICATION]** | Not Started |

---

## 9. Testing and Quality Assurance

### 9.1 Testing Strategy
- Unit testing: Business logic in shared packages; target ≥ 80% coverage
- Integration testing: Supabase Edge Functions tested with real API responses (Anthropic, GoCardless)
- End-to-end testing: Critical user flows (receipt capture, bank sync, analytics) via Playwright (web) and Detox (mobile)
- Performance testing: Dashboard load times and receipt parsing latency benchmarked per phase
- Security testing: RLS policies tested systematically; penetration testing before Phase 3 (banking data)

### 9.2 Test Scenarios

**Scenario 1: Receipt Parsing — Happy Path**
- Given: A clear photograph of a Biedronka receipt with 12 line items
- When: User uploads the photo
- Then: All 12 items extracted with correct names, quantities, and prices; automatically categorized

**Scenario 2: Receipt Parsing — Edge Case**
- Given: A crumpled, partially obscured receipt
- Then: Items Claude cannot read with confidence are flagged for user review; no silent data loss

**Scenario 3: Offline Capture**
- Given: User has no internet connection
- When: User photographs a receipt
- Then: Data is stored locally; syncs automatically when connection is restored with no data loss

**Scenario 4: Cross-Platform Sync**
- Given: User enters a manual transaction on the web app
- Then: The same transaction appears on the mobile app within 5 seconds

### 9.3 Acceptance Criteria
- [ ] Receipt OCR achieves ≥ 90% accuracy on test set of 100 diverse Polish receipts
- [ ] Real-time sync latency < 5 seconds in all tested conditions
- [ ] All user data is isolated by RLS — no data bleed between users in security testing
- [ ] GDPR data deletion request processed within 30 seconds
- [ ] App functions in offline mode (capture) and syncs correctly on reconnection

---

## 10. Launch and Rollout Plan

### 10.1 Launch Strategy
- Launch type: Phased (one phase at a time, with each phase building on the last)
- Phase 1 target audience: Private beta — developer/founder + close circle (< 10 users)
- Phase 2 target audience: Closed beta — invite-only early adopters (≤ 100 users)
- Phase 3+ target audience: Open beta, then public launch

### 10.2 Go-Live Checklist (Per Phase)
- [ ] All acceptance criteria for the phase met
- [ ] Security review completed (RLS policies, auth flows)
- [ ] Performance testing passed (latency benchmarks)
- [ ] GDPR compliance verified (data access, deletion, export)
- [ ] Error monitoring configured (Supabase logs, Sentry or equivalent)
- [ ] Rollback plan documented
- [ ] For Phase 3+: Banking integration tested with real accounts in staging

### 10.3 Communication Plan

| Audience | Message | Channel | Timing |
|----------|---------|---------|--------|
| Beta users (Phase 2) | AI receipt scanning now live | In-app notification + email | Phase 2 launch day |
| Beta users (Phase 3) | Bank sync now available — connect PKO BP | In-app notification + email | Phase 3 launch day |
| General public | Open beta announcement | **[NEEDS CLARIFICATION: Marketing channels not defined]** | Phase 3/4 launch |

---

## 11. Post-Launch

### 11.1 Monitoring Plan
- Metrics to track: OCR accuracy rate, sync latency P95, receipt capture completion rate, AI Coach engagement rate, 30-day retention
- Dashboard/tools: Supabase dashboard, custom analytics tables, **[NEEDS CLARIFICATION: external analytics tool not specified]**
- Alert thresholds: OCR error rate > 15% triggers investigation; sync latency P95 > 10s triggers alert

### 11.2 Success Evaluation
- Review date: 30 days after each phase launch
- Success criteria: Per-phase acceptance criteria metrics reviewed; qualitative feedback from beta users

### 11.3 Iteration Plan
- Feedback collection: In-app feedback prompt after first receipt scan; monthly NPS survey
- Improvement cycle: Bi-weekly sprint reviews; major feature iterations between phases

---

## 12. Support and Maintenance

### 12.1 Support Requirements
- Support channels: Email (Phase 1–2); in-app chat added in Phase 3+
- Support hours: **[NEEDS CLARIFICATION: Support availability not defined]**
- SLA targets: **[NEEDS CLARIFICATION: SLA targets not defined]**

### 12.2 Documentation
- User documentation: In-app onboarding tooltips; FAQ page (Phase 2+)
- Technical documentation: Inline code documentation; Supabase schema docs in repo
- API documentation: Edge Function endpoints documented in repo
- Training materials: N/A (consumer product)

### 12.3 Maintenance Plan
- Update frequency: Mobile app updates via Expo OTA for non-native changes; App Store/Play Store releases for native changes
- Backup strategy: Supabase automated daily backups (Point-in-Time Recovery enabled)
- Disaster recovery: **[NEEDS CLARIFICATION: RPO/RTO targets not specified]**

---

## 13. Budget and Resources

### 13.1 Team Structure

| Role | Name | Allocation | Duration |
|------|------|------------|----------|
| Product Manager / Founder | **[NEEDS CLARIFICATION]** | 100% | All phases |
| Full-Stack Developer | **[NEEDS CLARIFICATION]** | 100% | All phases |
| Mobile Developer | **[NEEDS CLARIFICATION]** | **[NEEDS CLARIFICATION]** | Phase 1+ |
| UI/UX Designer | **[NEEDS CLARIFICATION]** | **[NEEDS CLARIFICATION]** | Phase 1–2 |

### 13.2 Budget

| Item | Estimate |
|------|----------|
| Supabase (Pro plan) | ~$25/month |
| Anthropic API (Claude 3.5) | Variable — estimated $0.01–$0.05 per receipt parsed |
| GoCardless / Salt Edge | **[NEEDS CLARIFICATION: Pricing dependent on plan and transaction volume]** |
| Netlify (web hosting) | Free tier initially; Pro ~$19/month at scale |
| Expo EAS (mobile builds) | Free tier initially; Production plan ~$99/month |
| Total estimated monthly (Phase 1) | ~$25–50/month |
| Total estimated monthly (Phase 3+) | **[NEEDS CLARIFICATION: Dependent on user volume and banking API pricing]** |

---

## 14. Appendix

### 14.1 References
- Source document: `docs/Highlevel Project Requirements.rtf`
- Next.js App Router documentation
- Supabase documentation
- Anthropic API documentation (Claude 3.5 Sonnet vision capabilities)
- GoCardless Open Banking API documentation
- PSD2 regulatory framework (EU Directive 2015/2366)

### 14.2 Glossary
- **OCR**: Optical Character Recognition — automated extraction of text from images
- **PSD2**: EU Payment Services Directive 2 — regulatory framework enabling Open Banking
- **SKU**: Stock Keeping Unit — a specific individual product variant (e.g., "Żywiec 0.5L beer")
- **Free Cash Flow (personal)**: Income minus all fixed obligations, recurring bills, and discretionary commitments
- **RLS**: Row-Level Security — Supabase/PostgreSQL feature ensuring users only access their own data
- **Edge Function**: Server-side function running at the network edge (Supabase's serverless compute layer)
- **Anti-Lazy UX**: Design pattern using contextual nudges to prompt timely user action before inertia sets in
- **MoM / YoY**: Month-over-Month / Year-over-Year — standard period-over-period comparison metrics

### 14.3 Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-31 | **[NEEDS CLARIFICATION]** | Initial draft from high-level requirements |

---

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Manager | | | |
| Engineering Lead | | | |
| Design Lead | | | |
| Stakeholder | | | |
