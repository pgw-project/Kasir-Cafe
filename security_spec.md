# Security Specification - Kafe Maissy Coffee POS

This specification defines the security architecture, data invariants, and threat modeling for the Kafe Maissy Coffee POS Firestore database.

## 1. Data Invariants
*   **System Integrity**: Only the authorized Express backend server (`system@maissy.com`) has permission to read and write to the Firestore cloud collections. Direct unauthenticated client-side queries must be strictly rejected.
*   **Identity Pinning**: User profiles, menus, and transactions can only be synced by authenticated system accounts.
*   **Immutability**: Once a transaction is finalized (created), it cannot be modified or deleted.
*   **Strict Typing**: All values (prices, quantities, statuses) must match their exact data schema shapes and boundaries to prevent resource exhaustion attacks.

## 2. The "Dirty Dozen" Threat Payloads (Attack Vectors)
The following payloads simulate malicious client-side bypass attempts that must be denied by the security rules:

1.  **Direct Read Spill**: Attempting to read `/users` or `/transactions` directly from the client SDK without authentication.
2.  **Shadow User Creation**: An unauthenticated user writing a dummy admin account to `/users/USR-999` with `Role: "admin"`.
3.  **Privilege Escalation**: Attempting to modify an existing cashier account's role to `creator`.
4.  **Menu Poisoning**: An attacker writing a menu item with a negative price (`Harga: -50000`) to steal credit.
5.  **Menu DOS Attack**: Attempting to upload a 5MB base64 string as a menu name to trigger high bandwidth charges.
6.  **Transaction Deletion**: Attempting to delete a transaction record directly to clear sales history.
7.  **Transaction Modification**: Attempting to change the amount paid or customer name of a completed transaction.
8.  **Activity Log Wipe**: Attempting to clear the audit logs collection `/activity_log` to cover tracks.
9.  **Global Settings Tampering**: Attempting to rewrite the store name or Google Sheet ID in `/settings/global` directly.
10. **ID Character Poisoning**: Writing a document with non-standard characters in its ID (e.g., `MN-%20%3F`) to break path parsers.
11. **Negative Quantity Order**: Submitting a transaction detail where `Qty: -5` to manipulate sales reporting.
12. **Unauthenticated System Spoof**: Sending updates while signed in with a dummy consumer account that does not match the server's system email.

## 3. Test Runner Specification (`firestore.rules.test.ts`)
The security tests will assert that:
*   Unauthenticated users cannot read or write to any collection.
*   Non-system authenticated users cannot read or write to any collection.
*   The system user (`system@maissy.com`) can read, write, and sync all data safely.
