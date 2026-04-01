# User Stories Backlog — Finance Lifestyle OS

**Related PRD**: `docs/PRD_Finance-Lifestyle-OS.md`
**Version**: 1.0
**Date**: 2026-03-31
**Status**: Draft

---

## Epic Index

| Epic ID | Epic Name | Phase | Stories |
|---------|-----------|-------|---------|
| EPIC-001 | User Authentication & Onboarding | Phase 1 | US-001 – US-004 |
| EPIC-002 | Manual Expense Entry | Phase 1 | US-005 – US-007 |
| EPIC-003 | Cross-Platform Sync & Offline | Phase 1 | US-008 – US-009 |
| EPIC-004 | AI Receipt OCR | Phase 2 | US-010 – US-013 |
| EPIC-005 | Open Banking Integration | Phase 3 | US-014 – US-016 |
| EPIC-006 | SKU-Level Analytics | Phase 4 | US-017 – US-019 |
| EPIC-007 | AI Financial Coach | Phase 4 | US-020 – US-021 |
| EPIC-008 | Pro Mode — Net Worth & Investments | Phase 4 | US-022 – US-025 |
| EPIC-009 | Health vs. Wealth Analysis | Phase 5 | US-026 – US-027 |
| EPIC-010 | Gamification & Anti-Lazy UX | Phase 5 | US-028 – US-029 |

---

---

# EPIC-001: User Authentication & Onboarding

**Phase**: 1 — Foundation (MVP)
**Goal**: Users can securely create accounts, log in, and set up authentication on both web and mobile.

---

## US-001: User Registration

- **Story ID**: US-001
- **Epic**: EPIC-001 — User Authentication & Onboarding
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1 (Phase 1 deliverables)
- **Sprint**: Sprint 1
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P0-Critical

### Story
As a new user
I want to create an account using my email and password
So that I can access Finance Lifestyle OS and have my data securely stored

### Acceptance Criteria

**AC-1: Successful registration**
```gherkin
Given I am on the registration page
When I enter a valid email address, a password meeting complexity rules, and confirm the password
Then my account is created in Supabase Auth
And I am automatically logged in and redirected to the onboarding screen
```

**AC-2: Duplicate email rejected**
```gherkin
Given I am on the registration page
When I enter an email address that is already registered
Then I see an error message: "An account with this email already exists. Try logging in."
And no new account is created
```

**AC-3: Password validation**
```gherkin
Given I am on the registration page
When I enter a password shorter than 8 characters or without a number
Then I see an inline validation error describing the requirement
And the form cannot be submitted until corrected
```

**AC-4: Email verification**
```gherkin
Given I have submitted valid registration details
When my account is created
Then I receive a verification email from Supabase Auth
And my account access is limited until email is verified
```

### Non-Functional Criteria
- [ ] Registration API response < 500ms
- [ ] Password is never stored in plain text (Supabase Auth handles hashing)
- [ ] Form accessible via keyboard; all fields have proper ARIA labels

### Dependencies
**Blocked by**: None
**Blocks**: US-002 (login), US-003 (biometric), all authenticated features

### Technical Notes
- Use `supabase.auth.signUp()` with email confirmation enabled
- Supabase Auth handles password hashing — no custom crypto needed
- Redirect after verification via Supabase `redirectTo` param

---

## US-002: User Login (Email/Password)

- **Story ID**: US-002
- **Epic**: EPIC-001 — User Authentication & Onboarding
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 5.4
- **Sprint**: Sprint 1
- **Status**: Backlog
- **Story Points**: 2
- **Priority**: P0-Critical

### Story
As a registered user
I want to log in with my email and password
So that I can access my financial data securely

### Acceptance Criteria

**AC-1: Successful login**
```gherkin
Given I am on the login page
When I enter my registered email and correct password
Then I am authenticated and redirected to my dashboard
And a Supabase session token is stored securely
```

**AC-2: Invalid credentials rejected**
```gherkin
Given I am on the login page
When I enter an incorrect email or password
Then I see: "Invalid email or password"
And I am not logged in
And no session is created
```

**AC-3: Session persistence**
```gherkin
Given I am logged in and close the app/browser
When I reopen the app/browser within the session expiry window
Then I am still logged in without re-entering credentials
```

**AC-4: Logout**
```gherkin
Given I am logged in
When I tap "Log out"
Then my session is invalidated in Supabase
And I am redirected to the login screen
And no cached user data remains accessible
```

### Non-Functional Criteria
- [ ] Login API response < 300ms
- [ ] Brute force protection: account locked after 10 failed attempts (Supabase default)
- [ ] HTTPS only — no credentials transmitted over unencrypted connections

### Dependencies
**Blocked by**: US-001
**Blocks**: US-003, US-004, all authenticated features

---

## US-003: Biometric Authentication (Mobile)

- **Story ID**: US-003
- **Epic**: EPIC-001 — User Authentication & Onboarding
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 5.4
- **Sprint**: Sprint 2
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P1-High

### Story
As a mobile user
I want to unlock the app using Face ID or Touch ID
So that I can access my finances quickly without typing my password every time

### Acceptance Criteria

**AC-1: Biometric setup prompt**
```gherkin
Given I have logged in successfully on mobile for the first time
When I reach the dashboard
Then I am prompted to enable biometric authentication
And I can choose to enable or skip
```

**AC-2: Successful biometric unlock**
```gherkin
Given I have enabled biometrics and the app is locked
When I authenticate with Face ID or Touch ID
Then the app unlocks and I see my dashboard
And no password entry is required
```

**AC-3: Biometric failure fallback**
```gherkin
Given biometric authentication fails 3 times
When the user taps "Use Password"
Then I can log in with email and password
```

**AC-4: Biometric not available**
```gherkin
Given the device does not support Face ID or Touch ID
When I am on the security settings screen
Then biometric option is not shown
And only password-based auth is available
```

### Non-Functional Criteria
- [ ] Uses Expo LocalAuthentication API — no biometric data ever leaves the device
- [ ] Biometric authentication completes in < 2 seconds

### Dependencies
**Blocked by**: US-002
**Related to**: US-004 (2FA)

### Technical Notes
- Use `expo-local-authentication` for FaceID/TouchID
- Store the Supabase session token in Expo SecureStore; biometric unlocks access to the token — it does not replace Supabase auth

---

## US-004: Two-Factor Authentication (2FA)

- **Story ID**: US-004
- **Epic**: EPIC-001 — User Authentication & Onboarding
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 5.4
- **Sprint**: Sprint 2
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P1-High

### Story
As a security-conscious user
I want to enable two-factor authentication on my account
So that my financial data remains protected even if my password is compromised

### Acceptance Criteria

**AC-1: 2FA enrollment**
```gherkin
Given I am in Security Settings
When I enable 2FA and scan the QR code with an authenticator app
Then TOTP-based 2FA is activated on my account
And I am shown backup recovery codes to save
```

**AC-2: 2FA on login**
```gherkin
Given 2FA is enabled on my account
When I log in with valid email and password
Then I am prompted to enter a 6-digit TOTP code
And access is only granted when the correct code is entered
```

**AC-3: 2FA disable**
```gherkin
Given 2FA is enabled
When I disable it in Security Settings after confirming with my password
Then 2FA is removed from my account
And login no longer requires a TOTP code
```

### Dependencies
**Blocked by**: US-002
**Related to**: US-003

### Technical Notes
- Supabase Auth supports TOTP-based MFA natively — use `supabase.auth.mfa.*` APIs

---

---

# EPIC-002: Manual Expense Entry

**Phase**: 1 — Foundation (MVP)
**Goal**: Users can manually log transactions before AI and banking automation are available.

---

## US-005: Manual Transaction Entry (Mobile)

- **Story ID**: US-005
- **Epic**: EPIC-002 — Manual Expense Entry
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1 (Phase 1)
- **Sprint**: Sprint 2
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P0-Critical

### Story
As a mobile user
I want to manually add a transaction
So that I can track purchases even before receipt scanning is available

### Acceptance Criteria

**AC-1: Transaction creation**
```gherkin
Given I am on the mobile home screen
When I tap the "+" button and fill in amount, merchant name, category, and date
Then the transaction is saved to Supabase
And it appears in my transaction list immediately
```

**AC-2: Required fields validation**
```gherkin
Given I am creating a transaction
When I attempt to save without entering the amount
Then I see an inline error: "Amount is required"
And the transaction is not saved
```

**AC-3: Category selection**
```gherkin
Given I am creating a transaction
When I tap the Category field
Then a bottom sheet shows predefined categories (Groceries, Dining, Transport, etc.)
And I can select one and return to the form
```

**AC-4: Date defaults to today**
```gherkin
Given I open the new transaction form
When the form loads
Then the date field defaults to today's date
And I can tap to change it to a past date
```

### Non-Functional Criteria
- [ ] Form renders in < 300ms on mid-range Android device
- [ ] Accessible: amount field is numeric keyboard by default

### Dependencies
**Blocked by**: US-001, US-002
**Blocks**: US-008 (sync), US-009 (offline)

---

## US-006: Manual Transaction Entry (Web)

- **Story ID**: US-006
- **Epic**: EPIC-002 — Manual Expense Entry
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1 (Phase 1)
- **Sprint**: Sprint 2
- **Status**: Backlog
- **Story Points**: 2
- **Priority**: P1-High

### Story
As a web user
I want to manually add and edit transactions from the web dashboard
So that I can review and correct my financial records from a larger screen

### Acceptance Criteria

**AC-1: Transaction creation via web**
```gherkin
Given I am on the web dashboard
When I click "Add Transaction", fill in amount, merchant, category, and date, and click Save
Then the transaction is saved and appears in the transaction list
```

**AC-2: Transaction edit**
```gherkin
Given I am viewing a transaction in the list
When I click the edit icon and modify the amount or category
Then the updated transaction is saved
And the change is reflected in the list and any analytics
```

**AC-3: Transaction delete**
```gherkin
Given I am viewing a transaction
When I click delete and confirm the deletion prompt
Then the transaction is permanently removed from Supabase
And it no longer appears in the list or analytics
```

### Dependencies
**Blocked by**: US-001, US-002
**Related to**: US-005

---

## US-007: Category Management

- **Story ID**: US-007
- **Epic**: EPIC-002 — Manual Expense Entry
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.3
- **Sprint**: Sprint 3
- **Status**: Backlog
- **Story Points**: 2
- **Priority**: P1-High

### Story
As a user
I want to create, rename, and delete custom spending categories
So that my transaction organization reflects my personal financial structure

### Acceptance Criteria

**AC-1: Default categories pre-seeded**
```gherkin
Given a new user completes registration
When they first open the category list
Then they see default categories: Groceries, Dining, Transport, Health, Entertainment, Utilities, Clothing, Personal Care, Other
```

**AC-2: Custom category creation**
```gherkin
Given I am in the Categories settings
When I enter a category name and save
Then the new category appears in the category list
And is available for use in transactions
```

**AC-3: Category with assigned transactions cannot be deleted without reassignment**
```gherkin
Given a category has assigned transactions
When I attempt to delete it
Then I am prompted to reassign those transactions to another category before deletion proceeds
```

### Dependencies
**Blocked by**: US-001
**Related to**: US-005, US-006, US-011 (AI auto-categorization)

---

---

# EPIC-003: Cross-Platform Sync & Offline

**Phase**: 1 — Foundation (MVP)
**Goal**: Data entered on one platform instantly appears on the other; the app works without an internet connection.

---

## US-008: Real-Time Cross-Platform Sync

- **Story ID**: US-008
- **Epic**: EPIC-003 — Cross-Platform Sync & Offline
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 2
- **Sprint**: Sprint 3
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P0-Critical

### Story
As a user who uses both web and mobile
I want changes I make on one platform to immediately appear on the other
So that my data is always up to date regardless of which device I use

### Acceptance Criteria

**AC-1: Web-to-mobile sync**
```gherkin
Given I am logged in on both web and mobile simultaneously
When I add a transaction on the web
Then the transaction appears on the mobile app within 5 seconds
Without requiring me to manually refresh
```

**AC-2: Mobile-to-web sync**
```gherkin
Given I am logged in on both web and mobile simultaneously
When I photograph and confirm a receipt on mobile
Then the parsed transaction appears on the web dashboard within 5 seconds
```

**AC-3: No duplicate data**
```gherkin
Given the same transaction is submitted from web and mobile within 1 second of each other
When both submissions are processed
Then only one transaction record exists in the database
```

### Non-Functional Criteria
- [ ] Sync latency P95 < 5 seconds under normal network conditions
- [ ] Supabase Realtime subscriptions used for live updates

### Dependencies
**Blocked by**: US-005, US-006
**Related to**: US-009 (offline sync)

### Technical Notes
- Use Supabase Realtime `postgres_changes` subscription on the `transactions` table filtered by `user_id`
- RLS ensures users only receive their own change events

---

## US-009: Offline Receipt Capture

- **Story ID**: US-009
- **Epic**: EPIC-003 — Cross-Platform Sync & Offline
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4 NFR (Offline Mode)
- **Sprint**: Sprint 4
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P1-High

### Story
As a mobile user without internet access
I want to photograph or manually enter a transaction
So that I don't lose data just because I'm offline

### Acceptance Criteria

**AC-1: Offline capture queuing**
```gherkin
Given my device has no internet connection
When I photograph a receipt or enter a manual transaction
Then the data is saved locally on the device
And a status indicator shows "Syncing when online"
```

**AC-2: Automatic sync on reconnect**
```gherkin
Given I have offline-captured items in the local queue
When my device reconnects to the internet
Then all queued items are automatically synced to Supabase in the background
And the status indicator changes to "Synced"
```

**AC-3: No data loss on app restart while offline**
```gherkin
Given I have unsynced offline data and I force-close the app
When I reopen the app
Then the unsynced items are still present in the queue
And will sync when internet is restored
```

**AC-4: Conflict handling**
```gherkin
Given an offline-captured transaction has the same merchant/amount/date as a bank transaction imported while offline
When sync occurs
Then the system flags potential duplicates for user review rather than silently creating two records
```

### Non-Functional Criteria
- [ ] Offline queue persists across app restarts (use AsyncStorage or SQLite/MMKV)
- [ ] Queue processes in FIFO order

### Dependencies
**Blocked by**: US-005, US-008
**Related to**: US-011 (OCR — images must be queued offline too)

---

---

# EPIC-004: AI Receipt OCR

**Phase**: 2 — AI Magic
**Goal**: Users can photograph receipts and have them automatically parsed into line-item transactions.

---

## US-010: Receipt Photo Capture (Mobile)

- **Story ID**: US-010
- **Epic**: EPIC-004 — AI Receipt OCR
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 1
- **Sprint**: Sprint 5
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P0-Critical

### Story
As a mobile user
I want to photograph a paper receipt directly from the app
So that I can start the automatic parsing process without leaving the app

### Acceptance Criteria

**AC-1: Camera access**
```gherkin
Given I open the app after making a purchase
When I tap the camera icon on the home screen
Then the device camera opens within the app
```

**AC-2: Photo capture**
```gherkin
Given the camera is open
When I tap the shutter button
Then the photo is captured and shown in a preview screen
And I can retake or confirm it
```

**AC-3: Gallery upload alternative**
```gherkin
Given I am on the receipt capture screen
When I tap "Upload from gallery"
Then my photo gallery opens and I can select an existing image (e.g., a screenshot from a retail app)
```

**AC-4: Image quality guidance**
```gherkin
Given I confirm a photo that is very blurry (below quality threshold)
When the image is submitted for parsing
Then a warning is shown: "Receipt may be hard to read — try a clearer photo for best results"
And the user can choose to retry or proceed anyway
```

### Dependencies
**Blocked by**: EPIC-001 (auth), EPIC-003 (sync)
**Blocks**: US-011 (OCR parsing)

### Technical Notes
- Use `expo-image-picker` and `expo-camera`
- Compress image to < 2MB before upload to Supabase Storage and Anthropic API

---

## US-011: AI Receipt Line-Item Extraction

- **Story ID**: US-011
- **Epic**: EPIC-004 — AI Receipt OCR
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 1
- **Sprint**: Sprint 5
- **Status**: Backlog
- **Story Points**: 8
- **Priority**: P0-Critical

### Story
As a user who has photographed a receipt
I want the app to automatically extract every product, price, and quantity
So that I don't have to type out each line item manually

### Acceptance Criteria

**AC-1: Successful extraction**
```gherkin
Given I have submitted a clear photo of a Biedronka receipt with 10 line items
When the AI processing completes
Then all 10 products are shown with their correct names, quantities, and prices
And the store name and date are extracted
And the total matches the receipt total
```

**AC-2: Extraction time**
```gherkin
Given I have submitted a receipt photo
When the extraction is in progress
Then I see a loading indicator
And the results are presented within 10 seconds
```

**AC-3: Automatic category mapping**
```gherkin
Given a line item "Chleb Żytni 500g" is extracted
When the extraction completes
Then the item is automatically assigned to the "Groceries/Bread" category
And the mapping is visible in the review screen
```

**AC-4: Low-confidence items flagged**
```gherkin
Given a line item is partially illegible (e.g., obscured price)
When the extraction completes
Then the item is shown with a yellow warning icon
And a note: "We're not sure about this item — please review"
```

**AC-5: Polish language support**
```gherkin
Given a receipt with Polish product names (e.g., "Żurek staropolski")
When extracted
Then the product name is preserved in Polish
And correctly categorized based on the item type
```

### Non-Functional Criteria
- [ ] End-to-end parsing time (upload → results displayed) < 10 seconds
- [ ] ≥ 90% line-item accuracy on a test set of 100 Polish receipts
- [ ] Receipt images stored in private Supabase Storage (never public)
- [ ] Anthropic API key stored as Supabase Edge Function secret — never in client code

### Dependencies
**Blocked by**: US-010
**Blocks**: US-012 (review/correct)

### Technical Notes
- Architecture: Mobile → Upload image to Supabase Storage → Invoke Edge Function → Edge Function calls Anthropic API with base64 image → Returns structured JSON → Mobile renders review screen
- Use Claude 3.5 Sonnet vision API with a structured prompt requesting JSON output: `{store, date, items: [{name, quantity, unit_price, total_price, category}], total}`
- Cache prompt template in Edge Function; do not expose to client

---

## US-012: Review and Correct Parsed Receipt

- **Story ID**: US-012
- **Epic**: EPIC-004 — AI Receipt OCR
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 1
- **Sprint**: Sprint 6
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P0-Critical

### Story
As a user reviewing a parsed receipt
I want to correct any errors in the extracted line items before saving
So that my financial data is accurate

### Acceptance Criteria

**AC-1: Edit line item**
```gherkin
Given the review screen shows parsed items
When I tap a line item and change the product name, price, or category
Then the item is updated in the review list
And the total is recalculated
```

**AC-2: Delete incorrect line item**
```gherkin
Given a line item was incorrectly extracted (e.g., a loyalty card barcode read as a product)
When I swipe to delete it
Then it is removed from the list
And the total is recalculated
```

**AC-3: Add missing line item**
```gherkin
Given the AI missed a line item
When I tap "Add item manually" in the review screen
Then I can enter the product name, price, and category
And it is added to the receipt
```

**AC-4: Confirm and save all items**
```gherkin
Given I am satisfied with the reviewed items
When I tap "Save Receipt"
Then all line items are saved as individual transactions in Supabase
And I am returned to the home screen with a confirmation toast
```

### Dependencies
**Blocked by**: US-011

---

## US-013: Digital Receipt Screenshot Upload

- **Story ID**: US-013
- **Epic**: EPIC-004 — AI Receipt OCR
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 1
- **Sprint**: Sprint 6
- **Status**: Backlog
- **Story Points**: 2
- **Priority**: P1-High

### Story
As a user who shops online or uses store apps (Żabka, Biedronka)
I want to upload a screenshot of my digital receipt
So that I don't need a paper receipt to track my purchases

### Acceptance Criteria

**AC-1: Screenshot from gallery**
```gherkin
Given I am on the receipt capture screen
When I select "Upload Screenshot" and choose an image from my gallery
Then the image is submitted for AI parsing using the same pipeline as camera photos
```

**AC-2: App receipt screenshots recognized**
```gherkin
Given I upload a screenshot from the Żabka or Biedronka app
When the AI parses it
Then line items are extracted with the same accuracy as paper receipts
```

### Dependencies
**Blocked by**: US-010, US-011

---

---

# EPIC-005: Open Banking Integration

**Phase**: 3 — Banking
**Goal**: Automatically import bank transactions from Polish banks via PSD2.

---

## US-014: Connect Bank Account (PKO BP)

- **Story ID**: US-014
- **Epic**: EPIC-005 — Open Banking Integration
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 3
- **Sprint**: Sprint 8
- **Status**: Backlog
- **Story Points**: 8
- **Priority**: P0-Critical

### Story
As a PKO BP customer
I want to connect my bank account to Finance Lifestyle OS
So that my transactions are imported automatically without any manual entry

### Acceptance Criteria

**AC-1: Bank selection and OAuth flow**
```gherkin
Given I am in Settings → Connected Accounts
When I tap "Connect Bank" and select PKO BP
Then I am redirected to the GoCardless/Salt Edge OAuth screen
And I authenticate with my bank credentials on the bank's own interface
```

**AC-2: Successful connection confirmation**
```gherkin
Given I complete bank authentication
When I am redirected back to Finance Lifestyle OS
Then I see a confirmation: "PKO BP connected successfully"
And I see the account name and last 4 digits of the account number
```

**AC-3: Connection failure handling**
```gherkin
Given I cancel the bank OAuth flow or authentication fails
When I return to the app
Then I see: "Bank connection was not completed. Please try again."
And no partial connection is stored
```

**AC-4: Consent management**
```gherkin
Given my bank connection consent expires (PSD2 max 90 days)
When I open the app after expiry
Then I am notified that my bank connection needs to be renewed
And I can renew with one tap
```

### Non-Functional Criteria
- [ ] Bank credentials are entered only on the bank's own OAuth screen — never in the Finance Lifestyle OS app
- [ ] GoCardless/Salt Edge API keys stored as Supabase Edge Function secrets

### Dependencies
**Blocked by**: EPIC-001, EPIC-002 (baseline data model must exist)

---

## US-015: Automatic Transaction Import

- **Story ID**: US-015
- **Epic**: EPIC-005 — Open Banking Integration
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 3
- **Sprint**: Sprint 8
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P0-Critical

### Story
As a user with a connected bank account
I want my transactions to be fetched and categorized automatically
So that my spending data stays up to date without any action from me

### Acceptance Criteria

**AC-1: Automatic daily polling**
```gherkin
Given my bank account is connected
When 24 hours pass since the last sync
Then new transactions are automatically fetched and stored
And I see them in my transaction list
```

**AC-2: Transaction auto-categorization**
```gherkin
Given a bank transaction with merchant name "Biedronka"
When it is imported
Then it is automatically categorized as "Groceries"
And I can manually recategorize it if needed
```

**AC-3: Duplicate prevention**
```gherkin
Given a bank transaction has already been imported
When the next polling cycle runs
Then the same transaction is not imported again
```

**AC-4: Manual sync trigger**
```gherkin
Given I want fresher data than the last automatic sync
When I pull to refresh the transactions list
Then a manual sync is triggered
And new transactions appear within 10 seconds
```

### Dependencies
**Blocked by**: US-014

---

## US-016: Post-Purchase Push Notification Nudge

- **Story ID**: US-016
- **Epic**: EPIC-005 — Open Banking Integration
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 8 (Anti-Lazy UX)
- **Sprint**: Sprint 9
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P1-High

### Story
As a user with a connected bank account
I want to receive a push notification when a new transaction is detected
So that I'm reminded to photograph the receipt before I discard it

### Acceptance Criteria

**AC-1: Transaction-triggered notification**
```gherkin
Given a new transaction is imported from my bank
When it is detected
Then I receive a push notification: "You just spent [amount] at [merchant]. Snap a photo of your receipt now."
```

**AC-2: Notification deep-links to camera**
```gherkin
Given I receive a post-purchase notification
When I tap it
Then the app opens directly to the receipt camera screen
And the merchant name is pre-filled
```

**AC-3: Notification preferences**
```gherkin
Given I am in Notification Settings
When I disable purchase nudge notifications
Then no further push notifications are sent for new transactions
```

### Dependencies
**Blocked by**: US-014, US-015

---

---

# EPIC-006: SKU-Level Analytics

**Phase**: 4 — Pro & Analytics
**Goal**: Users can analyze spending at the individual product level, with trend and anomaly detection.

---

## US-017: Spending Analytics Dashboard

- **Story ID**: US-017
- **Epic**: EPIC-006 — SKU-Level Analytics
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 4
- **Sprint**: Sprint 11
- **Status**: Backlog
- **Story Points**: 8
- **Priority**: P0-Critical

### Story
As a user
I want to see a visual summary of my spending by category and by time period
So that I can understand where my money is going at a glance

### Acceptance Criteria

**AC-1: Category breakdown chart**
```gherkin
Given I have at least 10 transactions
When I open the Analytics dashboard and select "This Month"
Then I see a chart showing spending broken down by category
And each segment shows the total amount and percentage of total spend
```

**AC-2: Period selector**
```gherkin
Given I am on the Analytics dashboard
When I switch the period selector between "This Week", "This Month", "Last Month", "This Year"
Then all charts and totals update to reflect the selected period
```

**AC-3: Category drill-down**
```gherkin
Given I tap a category in the analytics chart
When the drill-down view opens
Then I see a list of all transactions in that category for the selected period
Sorted by date descending
```

### Dependencies
**Blocked by**: EPIC-002, EPIC-003, EPIC-004

---

## US-018: SKU-Level Product Spending View

- **Story ID**: US-018
- **Epic**: EPIC-006 — SKU-Level Analytics
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 4
- **Sprint**: Sprint 11
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P1-High

### Story
As a user
I want to search for a specific product and see how much I've spent on it over time
So that I can track habits at the SKU level (e.g., "how much did I spend on sparkling water this year?")

### Acceptance Criteria

**AC-1: Product search**
```gherkin
Given I am on the SKU analytics screen
When I type "woda" in the search bar
Then I see all distinct products containing "woda" in their name, with total spend per product
```

**AC-2: Product price history**
```gherkin
Given I tap a specific product (e.g., "Woda Żywiec 1.5L")
When the product detail view opens
Then I see a line chart of the unit price for that product over time
And I can see when the price changed
```

**AC-3: Quantity and spend totals**
```gherkin
Given I am viewing a product's detail
When I look at the summary section
Then I see: total units purchased, total amount spent, average unit price, last purchase date
```

### Dependencies
**Blocked by**: US-011 (requires SKU-level data from OCR), US-017

---

## US-019: Anomaly Detection — Price Change Alerts

- **Story ID**: US-019
- **Epic**: EPIC-006 — SKU-Level Analytics
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 4
- **Sprint**: Sprint 12
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P2-Medium

### Story
As a user who regularly buys the same products
I want to be alerted when the price of a regular purchase changes significantly
So that I can spot price hikes before they erode my budget

### Acceptance Criteria

**AC-1: Price anomaly detected**
```gherkin
Given I have purchased "Masło Łaciate 200g" at least 3 times
When a new purchase price exceeds the average by more than 15%
Then an anomaly flag is shown on that product in the analytics view
And an in-app notification is created: "Price of Masło Łaciate increased by 20% compared to your usual price"
```

**AC-2: User can dismiss anomaly**
```gherkin
Given a price anomaly alert is shown
When I tap "Dismiss"
Then the alert is hidden
And the new price is treated as the updated baseline
```

### Dependencies
**Blocked by**: US-018

---

---

# EPIC-007: AI Financial Coach

**Phase**: 4 — Pro & Analytics
**Goal**: Proactive AI-driven insights help users make better financial decisions.

---

## US-020: Weekly AI Spending Insight

- **Story ID**: US-020
- **Epic**: EPIC-007 — AI Financial Coach
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 7
- **Sprint**: Sprint 12
- **Status**: Backlog
- **Story Points**: 8
- **Priority**: P1-High

### Story
As a user with at least 30 days of spending data
I want to receive a weekly personalized insight from the AI Coach
So that I have a concrete action I can take to improve my finances

### Acceptance Criteria

**AC-1: Weekly insight generated**
```gherkin
Given I have 30+ days of transaction data
When a new week begins (Monday)
Then a new AI Coach insight card appears on my dashboard
Containing a specific, personalized recommendation based on my actual spending
```

**AC-2: Insight references real data**
```gherkin
Given my spending on food delivery averaged 350 PLN/month for the past 3 months
When the AI generates an insight
Then the insight references actual figures: "You spent 350 PLN/month on food delivery. Reducing this by 30% would free up 105 PLN/month."
```

**AC-3: User can save or dismiss**
```gherkin
Given I see an AI Coach insight card
When I tap "Save to Goals"
Then the insight is saved to my Goals section
When I tap "Dismiss"
Then the card is removed from the dashboard
```

### Non-Functional Criteria
- [ ] AI insight generation runs server-side (Supabase scheduled Edge Function) — not on-demand per user request to control API costs
- [ ] Insights are generated in batch weekly, not in real time

### Dependencies
**Blocked by**: US-017, US-018 (needs sufficient analytics data)

---

## US-021: Free Cash Flow Visualization

- **Story ID**: US-021
- **Epic**: EPIC-007 — AI Financial Coach
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 2.3 (Cashflow Management)
- **Sprint**: Sprint 13
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P1-High

### Story
As a user
I want to see a clear view of my Free Cash Flow after all obligations
So that I know exactly how much money I genuinely have available each month

### Acceptance Criteria

**AC-1: Free Cash Flow calculation**
```gherkin
Given I have entered my monthly income and marked certain transactions as recurring obligations
When I open the Cash Flow screen
Then I see: Income − Fixed Obligations − Recurring Bills − Discretionary Spending = Free Cash Flow
And each component shows a breakdown
```

**AC-2: Recurring obligation tagging**
```gherkin
Given I am editing a transaction (e.g., rent)
When I toggle "Mark as recurring"
Then that transaction is classified as a fixed obligation in cash flow calculations for all future months
```

### Dependencies
**Blocked by**: US-005, US-006, US-017

---

---

# EPIC-008: Pro Mode — Net Worth & Investments

**Phase**: 4 — Pro & Analytics
**Goal**: Power users track total net worth, investments, and model long-term growth.

---

## US-022: Net Worth Tracker

- **Story ID**: US-022
- **Epic**: EPIC-008 — Pro Mode
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 2.3
- **Sprint**: Sprint 13
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P1-High

### Story
As a Pro mode user
I want to log all my assets and liabilities
So that I always know my current net worth

### Acceptance Criteria

**AC-1: Add asset**
```gherkin
Given I am in the Net Worth section of Pro mode
When I tap "Add Asset" and select type (cash, deposit, real estate, vehicle), enter value and name
Then the asset is saved and added to the total assets figure
```

**AC-2: Add liability**
```gherkin
Given I tap "Add Liability" and enter type (loan, credit card, mortgage), balance, and monthly payment
Then the liability is saved and deducted from net worth
```

**AC-3: Net worth calculated**
```gherkin
Given I have added 3 assets totaling 150,000 PLN and 2 liabilities totaling 40,000 PLN
When I view the Net Worth dashboard
Then I see Net Worth = 110,000 PLN
And a breakdown of assets vs. liabilities
```

**AC-4: Historical tracking**
```gherkin
Given I have updated my asset values over multiple months
When I view the Net Worth history chart
Then I see a line chart of my net worth over time
```

### Dependencies
**Blocked by**: EPIC-001 (auth)

---

## US-023: Investment Portfolio Tracking (Manual)

- **Story ID**: US-023
- **Epic**: EPIC-008 — Pro Mode
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 2.3
- **Sprint**: Sprint 13
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P2-Medium

### Story
As a Pro mode user
I want to manually add my investment holdings (stocks, crypto, funds)
So that I can see their value alongside my spending data

### Acceptance Criteria

**AC-1: Add investment holding**
```gherkin
Given I am in the Investment Hub
When I add a holding with type (stock/crypto/fund), ticker/name, number of units, and purchase price
Then it is saved and shown in my portfolio
```

**AC-2: Manual value update**
```gherkin
Given I have a holding in my portfolio
When I update the current price per unit
Then the portfolio value is recalculated
And the gain/loss vs. purchase price is shown
```

### Dependencies
**Blocked by**: US-022

---

## US-024: Compound Interest Calculator

- **Story ID**: US-024
- **Epic**: EPIC-008 — Pro Mode
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 2.3
- **Sprint**: Sprint 14
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P2-Medium

### Story
As a Pro mode user
I want to model how my savings or investments grow with compound interest
So that I can make informed decisions about long-term financial goals

### Acceptance Criteria

**AC-1: Calculator inputs accepted**
```gherkin
Given I am on the Compound Interest Calculator
When I enter initial principal (1000 PLN), annual interest rate (7%), compounding frequency (monthly), and time horizon (10 years)
Then the calculator shows projected value and total interest earned
```

**AC-2: Multi-horizon comparison**
```gherkin
Given I have entered inputs
When the results are shown
Then I see projected values for 5, 10, and 20 years simultaneously for easy comparison
```

### Dependencies
**Blocked by**: US-022

---

## US-025: Investment Portfolio via API (Crypto Pricing)

- **Story ID**: US-025
- **Epic**: EPIC-008 — Pro Mode
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 5.5
- **Sprint**: Sprint 14
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P2-Medium

### Story
As a Pro mode user with crypto holdings
I want prices to update automatically via CoinGecko
So that my portfolio value is always current without manual updates

### Acceptance Criteria

**AC-1: Auto-price refresh**
```gherkin
Given I have added BTC and ETH holdings with ticker symbols
When I open the Investment Hub
Then current prices are fetched from CoinGecko and portfolio values updated automatically
```

**AC-2: Price fetch failure handled**
```gherkin
Given CoinGecko API is unavailable
When the app attempts to refresh prices
Then last known prices are shown with a "Last updated: [timestamp]" label
And no error is shown to the user beyond that label
```

### Dependencies
**Blocked by**: US-023

---

---

# EPIC-009: Health vs. Wealth Analysis

**Phase**: 5 — Gamification & Health
**Goal**: Users see the financial cost of their lifestyle habits through health-labeled spending data.

---

## US-026: Product Health Labeling

- **Story ID**: US-026
- **Epic**: EPIC-009 — Health vs. Wealth Analysis
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 5
- **Sprint**: Sprint 16
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P2-Medium

### Story
As a user
I want products in my purchase history to be labeled as Healthy, Neutral, or Harmful by default
So that I can see the health dimension of my spending without manual tagging

### Acceptance Criteria

**AC-1: Default health labels applied by category**
```gherkin
Given a transaction is categorized as "Alcohol" or "Tobacco"
When it is stored
Then it is automatically labeled "Harmful"
Given a transaction is categorized as "Fruits/Vegetables"
Then it is automatically labeled "Healthy"
```

**AC-2: User can override label**
```gherkin
Given a product has been auto-labeled "Harmful"
When I tap the label and select a different one
Then my override is saved and used for that product going forward
```

**AC-3: Health label visible in transaction list**
```gherkin
Given I am viewing my transaction list
When health labels are enabled in settings
Then each transaction shows a small Healthy/Neutral/Harmful badge
```

### Dependencies
**Blocked by**: US-011 (requires OCR category data), US-007

---

## US-027: Financial Cost of Habits Report

- **Story ID**: US-027
- **Epic**: EPIC-009 — Health vs. Wealth Analysis
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 5
- **Sprint**: Sprint 16
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P2-Medium

### Story
As a health-conscious user
I want to see a dedicated report showing how much I've spent on "Harmful" products over time
So that I can understand the true financial cost of my habits

### Acceptance Criteria

**AC-1: Habits report page**
```gherkin
Given I have 60+ days of labeled spending data
When I open the "Health vs. Wealth" report
Then I see annual spend broken down by habit category (Sugar, Alcohol, Tobacco, Fast Food, Energy Drinks)
```

**AC-2: Comparative framing**
```gherkin
Given my annual alcohol spend is 2,400 PLN
When the report renders
Then it shows a comparison: "2,400 PLN = 2 months of grocery shopping" or "= 8 months of gym membership"
```

**AC-3: Trend over time**
```gherkin
Given I view the MoM trend for "Sugar" category
When I select the trend chart
Then I see if my sugar spending has increased or decreased over the last 6 months
```

### Dependencies
**Blocked by**: US-026, US-017

---

---

# EPIC-010: Gamification & Anti-Lazy UX

**Phase**: 5 — Gamification & Health
**Goal**: Motivational mechanics increase consistency and data completeness.

---

## US-028: Receipt Capture Streak

- **Story ID**: US-028
- **Epic**: EPIC-010 — Gamification & Anti-Lazy UX
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 8
- **Sprint**: Sprint 17
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P3-Low

### Story
As a user
I want to see a streak counter for consecutive days I've captured at least one receipt or transaction
So that I'm motivated to maintain consistent financial tracking

### Acceptance Criteria

**AC-1: Streak displayed on home screen**
```gherkin
Given I have logged at least one transaction or receipt 5 days in a row
When I open the home screen
Then I see a streak counter showing "5-day streak 🔥"
```

**AC-2: Streak broken notification**
```gherkin
Given I had a 10-day streak
When I miss a day without logging anything
Then the streak resets to 0
And I receive a push notification: "Your 10-day streak ended. Start a new one today!"
```

**AC-3: Streak freeze (grace period)**
```gherkin
Given my bank account is connected and a transaction was auto-imported on a day I didn't manually capture anything
When the streak is evaluated
Then that day counts toward the streak (auto-import satisfies the requirement)
```

### Dependencies
**Blocked by**: EPIC-004, EPIC-005

---

## US-029: Configurable Financial Nudge Notifications

- **Story ID**: US-029
- **Epic**: EPIC-010 — Gamification & Anti-Lazy UX
- **Related Documents**:
  - PRD Section: PRD_Finance-Lifestyle-OS.md, Section 4.1, Feature 8
- **Sprint**: Sprint 17
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P3-Low

### Story
As a user
I want to configure which nudge notifications I receive
So that I can stay motivated without feeling spammed

### Acceptance Criteria

**AC-1: Notification settings screen**
```gherkin
Given I am in Notification Settings
When the screen loads
Then I see toggles for: Post-purchase receipt reminder, Streak break alert, Weekly AI Coach insight, Monthly spending summary
```

**AC-2: Individual toggle respected**
```gherkin
Given I have disabled "Post-purchase receipt reminder"
When a new bank transaction is detected
Then no push notification is sent for that event
```

**AC-3: Quiet hours**
```gherkin
Given I have set quiet hours 22:00–08:00
When a notification would be sent within that window
Then the notification is queued and delivered at 08:00 instead
```

### Dependencies
**Blocked by**: US-016, US-028

---

---

## Story Summary

| Story ID | Title | Phase | Epic | Points | Priority | Status |
|----------|-------|-------|------|--------|----------|--------|
| US-001 | User Registration | 1 | EPIC-001 | 3 | P0 | Backlog |
| US-002 | User Login | 1 | EPIC-001 | 2 | P0 | Backlog |
| US-003 | Biometric Authentication | 1 | EPIC-001 | 3 | P1 | Backlog |
| US-004 | Two-Factor Authentication | 1 | EPIC-001 | 3 | P1 | Backlog |
| US-005 | Manual Transaction Entry (Mobile) | 1 | EPIC-002 | 3 | P0 | Backlog |
| US-006 | Manual Transaction Entry (Web) | 1 | EPIC-002 | 2 | P1 | Backlog |
| US-007 | Category Management | 1 | EPIC-002 | 2 | P1 | Backlog |
| US-008 | Real-Time Cross-Platform Sync | 1 | EPIC-003 | 5 | P0 | Backlog |
| US-009 | Offline Receipt Capture | 1 | EPIC-003 | 5 | P1 | Backlog |
| US-010 | Receipt Photo Capture | 2 | EPIC-004 | 3 | P0 | Backlog |
| US-011 | AI Receipt Line-Item Extraction | 2 | EPIC-004 | 8 | P0 | Backlog |
| US-012 | Review and Correct Parsed Receipt | 2 | EPIC-004 | 5 | P0 | Backlog |
| US-013 | Digital Screenshot Upload | 2 | EPIC-004 | 2 | P1 | Backlog |
| US-014 | Connect Bank Account (PKO BP) | 3 | EPIC-005 | 8 | P0 | Backlog |
| US-015 | Automatic Transaction Import | 3 | EPIC-005 | 5 | P0 | Backlog |
| US-016 | Post-Purchase Push Notification | 3 | EPIC-005 | 3 | P1 | Backlog |
| US-017 | Spending Analytics Dashboard | 4 | EPIC-006 | 8 | P0 | Backlog |
| US-018 | SKU-Level Product Spending View | 4 | EPIC-006 | 5 | P1 | Backlog |
| US-019 | Anomaly Detection — Price Alerts | 4 | EPIC-006 | 5 | P2 | Backlog |
| US-020 | Weekly AI Spending Insight | 4 | EPIC-007 | 8 | P1 | Backlog |
| US-021 | Free Cash Flow Visualization | 4 | EPIC-007 | 5 | P1 | Backlog |
| US-022 | Net Worth Tracker | 4 | EPIC-008 | 5 | P1 | Backlog |
| US-023 | Investment Portfolio (Manual) | 4 | EPIC-008 | 3 | P2 | Backlog |
| US-024 | Compound Interest Calculator | 4 | EPIC-008 | 3 | P2 | Backlog |
| US-025 | Investment Portfolio via API | 4 | EPIC-008 | 5 | P2 | Backlog |
| US-026 | Product Health Labeling | 5 | EPIC-009 | 5 | P2 | Backlog |
| US-027 | Financial Cost of Habits Report | 5 | EPIC-009 | 5 | P2 | Backlog |
| US-028 | Receipt Capture Streak | 5 | EPIC-010 | 3 | P3 | Backlog |
| US-029 | Configurable Nudge Notifications | 5 | EPIC-010 | 3 | P3 | Backlog |

**Total Story Points**: 127
**Phase 1 Points**: 28 (US-001 to US-009)
**Phase 2 Points**: 18 (US-010 to US-013)
**Phase 3 Points**: 16 (US-014 to US-016)
**Phase 4 Points**: 47 (US-017 to US-025)
**Phase 5 Points**: 16 (US-026 to US-029)
