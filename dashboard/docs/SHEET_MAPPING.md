# TMV Spreadsheet Schema & Mapping Reference

This document provides a comprehensive mapping between the live Google Sheets workbook and the TMV Operations Dashboard (`/ops`).

---

## 1. Tab Inventory & Status

| Sheet Tab Name | Status | Read in /ops | Notes |
| :--- | :--- | :--- | :--- |
| **`Bookings`** | **LIVE** | **YES** | Primary source for all operational jobs |
| **`Drivers`** | **LIVE** | **YES** | Driver profiles and initials mapping |
| **`WorkflowState`** | **LIVE** | **YES** | Active workflow stage per job |
| **`DriverFlow`** | **LIVE** | **YES** | Step-by-step driver interaction field audit |
| **`Payments`** | **LIVE** | **YES** | Recorded customer payments and methods |
| **`Signatures`** | **LIVE** | **YES** | Customer sign-offs and Pad links |
| **`Evidence`** | **LIVE** | **YES** | Durable upload queue items & error states |
| **`Photos`** | **LIVE** | **YES** | Photo records with Drive file IDs |
| **`ActivityLog`** | **LIVE** | **YES** | Chronological state-transition audit log |
| **`ProcessedEvents`** | **LIVE** | **YES** | Deduplication event keys |
| **`ExceptionReport`** | **LIVE** | **YES** | Unhandled system errors (surfaced in UI) |
| **`Settings`** | **LIVE** | **YES** | Customer confirmation texts |
| **`StorageCheckIn`** | **LIVE** | **YES** | Container check-in scenario records |
| **`StorageCheckOut`** | **LIVE** | **YES** | Container check-out scenario records |
| **`ParkingLiability`** | **LIVE** | **YES** | Parking liability waiver scenario records |
| **`LiabilityReport`** | **LIVE** | **YES** | Damage report scenario records |
| **`PendingSignatures`**| **LIVE** | **YES** | Chat message names waiting for signature |
| **`ScenarioProgress`** | **LIVE** | **YES** | Form step progress state |
| `Dashboard` | **DEAD** | **NO** | Legacy unpopulated tab; excluded from batch read |
| `Analytics` | **DEAD** | **NO** | Legacy unpopulated tab; excluded from batch read |
| `Reports` | **DEAD** | **NO** | Legacy unpopulated tab; excluded from batch read |
| `Customers` | **DEAD** | **NO** | Legacy unpopulated tab; excluded from batch read |

---

## 2. Core Tab Header Specifications

### `Bookings` (33 Columns)
1. `Job ID` (e.g. `TMV-B647CA40F3`)
2. `Calendar Event ID`
3. `Driver Initials` (Joined to `Drivers.Initials` -> `Drivers.Full Name`)
4. `Customer`
5. `Customer Email`
6. `Phone`
7. `Pickup`
8. `Dropoff`
9. `Crew Size`
10. `Base Price` (Converted to `Pence`)
11. `Paid Online` (Boolean)
12. `Booked Start` (ISO-8601 UTC)
13. `Booked Finish` (ISO-8601 UTC)
14. `Actual Start` (ISO-8601 UTC)
15. `Actual Finish` (ISO-8601 UTC)
16. `Booked Minutes` (Integer)
17. `Actual Minutes` (Integer)
18. `Difference Minutes` (Delay variance)
19. `Delay Status` (Delay band classification)
20. `Extra Charges` (Pence)
21. `Overtime Minutes` (Integer)
22. `Overtime Charge` (Pence; calculated at £55/30m)
23. `Total Charges` (Pence; base + extras + overtime)
24. `Payment Method` (`Cash`, `Card`, `Bank Transfer`, `Invoice`)
25. `Payment Status` (`PAID`, `UNPAID`)
26. `Client Name/Postcode`
27. `Client Confirmed By`
28. `Status` (`READY`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`)
29. `Current State`
30. `Drive Folder ID`
31. `Drive Folder URL`
32. `Created` (ISO-8601 UTC)
33. `Updated` (ISO-8601 UTC)

### `Evidence` (15 Columns)
1. `Evidence ID`
2. `Job ID`
3. `Driver`
4. `Evidence Type` (`Arrival`, `VanLoaded`, `EmptyVan`, `Organized`)
5. `Attachment Ref`
6. `Content Type`
7. `File Name`
8. `Status` (`RECEIVED`, `PROCESSING`, `COMPLETED`, `FAILED`)
9. `Received`
10. `Processing Started`
11. `Processing Completed`
12. `Drive File ID`
13. `Drive URL`
14. `Retry Count`
15. `Last Error`

---

## 3. Four Evidence States & Three-Way Classification

- **`COMPLETED`**: Durable row status is `COMPLETED` with valid `Drive File ID`. (Green indicator)
- **`PROCESSING`**: Durable row status is `RECEIVED` or `PROCESSING`. (Amber spinner indicator)
- **`FAILED`**: Durable row status is `FAILED` or retries exceeded. (Red indicator with error details)
- **`MISSING`**: No evidence row present for mandatory step. (Pink / Purple indicator)
