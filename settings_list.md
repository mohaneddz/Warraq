# Warraq Library Settings Reference

This file documents all the configuration settings available in the Warraq settings interface, including their internal preference keys, data types, and default/available options.

---

## 1. General & Identity
*Defines core library identity and librarian profile settings.*

| Setting Name | Preferences Key | Type | Default Value / Options | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Library Name** | `libraryName` | String | `"Mustapha Bacha Hospital Library"` | Official name of the library. |
| **Short Name** | `libraryShortName` | String | `"Warraq"` | Abbreviated name used for compact UI layouts. |
| **Librarian / Operator Name** | `operatorName` | String | `""` | Name of the primary operator printed on slips and logs. |
| **Operator Email** | `operatorEmail` | String | `""` | Contact email address for the active operator. |
| **Operator Avatar** | `operatorAvatar` | String (Path) | `null` | Image file path for the operator's profile avatar. |

---

## 2. Library Profile
*Institution contact details displayed on member cards, receipts, and reports.*

| Setting Name | Preferences Key | Type | Options | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Library Address** | `libraryAddress` | String | Text | Physical street address of the library. |
| **City** | `libraryCity` | String | Text | City location of the library. |
| **Phone Number** | `libraryPhone` | String | Text | Contact phone number printed on member slips. |
| **Email Address** | `libraryEmail` | String | Text | Public email address for library queries. |
| **Website** | `libraryWebsite` | String | Text | Library portal or hospital site URL. |
| **Hours of Operation** | `libraryHours` | String | Text | Library open/close hours displayed to users. |
| **About / Description** | `libraryDescription` | String | Text | Short summary about the library. |

---

## 3. Localization
*Regional settings for date formats, currency, timezone, and language.*

| Setting Name | Preferences Key | Type | Options | Description |
| :--- | :--- | :--- | :--- | :--- |
| **System Language** | `locale` | Enum | `"en"` (English)<br>`"fr"` (Français)<br>`"ar"` (العربية) | System language. Selecting Arabic automatically enables RTL. |
| **Timezone** | `timezone` | Enum | `"Africa/Algiers"`, `"Africa/Cairo"`, `"Africa/Tunis"`, `"Europe/Paris"`, etc. | Regional timezone used for audit timestamps and due calculations. |
| **Date Format** | `dateFormat` | Enum | `"dd/MM/yyyy"`<br>`"MM/dd/yyyy"`<br>`"yyyy-MM-dd"` | Preferred format to display dates throughout the app. |
| **Currency** | `currency` | Enum | `DZD`, `EUR`, `USD`, `GBP`, `MAD`, `TND`, `SAR`, `AED` | Local currency symbol for budget and fee reports. |

---

## 4. Appearance
*Interface themes, accent colors, and typography scaling.*

| Setting Name | Preferences Key | Type | Options | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Interface Theme** | `theme` | Enum | `"light"` (Light)<br>`"dark"` (Dark)<br>`"system"` (Follow OS) | Controls the visual color scheme of the application. |
| **Accent Color** | `accentColor` | Hex String | Emerald (`#1a4d40`), Copper (`#b96f3e`), Navy (`#3b5998`), Violet (`#7c3aed`), Ruby (`#dc2626`), Sapphire (`#0284c7`) | Active highlight color for buttons, selections, and focus rings. |
| **Font Size** | `fontSize` | Enum | `"small"` (13px)<br>`"medium"` (15px)<br>`"large"` (17px) | Layout text density for accessibility and screen sizes. |

---

## 5. Circulation Rules
*Rules governing catalog checkout durations, renewals, and borrowing limits.*

| Setting Name | Preferences Key | Type | Options | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Default Loan Period** | `loanDays` | Number | Integer (Days) | Default checkout duration before a book is marked overdue. |
| **Max Concurrent Loans** | `loanLimit` | Number | Integer (Books) | Max number of active checkouts allowed per member at one time. |
| **Max Renewal Count** | `renewLimit` | Number | Integer (Times) | Max number of times a member can extend a loan before return. |
| **Hold Shelf Lifetime** | `reservationHoldDays` | Number | Integer (Days) | Number of days a reserved book stays on the hold shelf for pickup. |
| **Grace Period** | `gracePeriodEnabled` | Boolean | `true` / `false` | Whether to offer a fee-free buffer period after due date. |
| **Grace Period Duration** | `gracePeriodDays` | Number | Integer (Days) | Number of days a loan can be overdue before daily fines begin. |
| **Self-Service Renewal** | `selfRenewalAllowed` | Boolean | `true` / `false` | Permits members to renew loans themselves. |

---

## 6. Fines & Fees
*Configure overdue fee structures, currency, and accepted payment options.*

| Setting Name | Preferences Key | Type | Options | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Enable Overdue Fines** | `finesEnabled` | Boolean | `true` / `false` | Enables tracking and calculation of daily overdue fees. |
| **Daily Fine Amount** | `finePerDay` | Number | Decimal | Fine accrued per overdue book for every day beyond grace period. |
| **Max Fine Limit** | `maxFineAmount` | Number | Decimal | Capped maximum fine amount that can accrue per item. |
| **Fine Currency** | `fineCurrency` | String | Same as `currency` | Currency symbol used for fines. |
| **Payment Methods** | `finesPaymentMethod` | Enum | `"cash"`, `"card"`, `"both"` | Accepted payment methods for settling library fines. |

---

## 7. Notifications
*Configure dashboard alerts and pop-up alerts.*

| Setting Name | Preferences Key | Type | Options | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Overdue Alerts** | `notifyOverdue` | Boolean | `true` / `false` | Generate notifications for books that have passed due date. |
| **Due Soon Reminders** | `notifyDueSoon` | Boolean | `true` / `false` | Generate warnings when items are approaching their due date. |
| **Due Soon Threshold** | `notifyDueSoonDays` | Number | Integer (Days) | Number of days before the due date to trigger a "due soon" alert. |
| **Hold Pickup Notices** | `notifyReady` | Boolean | `true` / `false` | Notify when reserved items are returned and ready for pickup. |

---

## 8. Integrations & AI
*Configure database lookup services and artificial intelligence integrations.*

| Setting Name | Preferences Key | Type | Options | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Google Books API** | `googleBooksEnabled` | Boolean | `true` / `false` | Use Google Books during ISBN scans for book details lookup. |
| **OpenLibrary API** | `openLibraryEnabled` | Boolean | `true` / `false` | Fallback lookup service for digital catalog auto-fill. |
| **OpenAI API Key** | `openAIKey` | Password String | String | Key used for optional AI-assisted summaries and content extraction. |
| **Groq API Key** | `groqApiKey` | Password String | String | Key used for fast local LLM actions and metadata filling. |

---

## 9. Desktop & Data (System)
*Manage desktop application behavior and data retention controls.*

| Setting Name | Preferences Key | Type | Options | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Minimize to System Tray** | `closeToTray` | Boolean | `true` / `false` | Hiding the window keeps Warraq running in system tray on close. |
| **Auto-save Settings** | `autosaveEnabled` | Boolean | `true` / `false` | Auto-save configuration adjustments in background. |
| **Auto-save Interval** | `autosaveInterval` | Number | Integer (Seconds) | Frequency in seconds to write preferences to storage. |
| **Default Page Size** | `pageSize` | Number | `10`, `25`, `50`, `100` | Default number of records shown in tables before pagination. |
