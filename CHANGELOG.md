# Changelog

All notable changes to the Punjab Retail Management System (PRMS) SaaS platform will be documented in this file.

## [1.1.0] - 2026-07-02
### Added
- **Authentication Lockout**: Lock user accounts for 15 minutes after 5 consecutive failed login attempts.
- **Failed Login Auditing**: Detailed AuditLog entries capturing IP address, browser User-Agent, timestamp, and target identifier on credential failures.
- **Configurable Password Policy**: Password complexity validation dynamically resolved from database-configured shop `Settings` columns.
- **In-Memory Rate Limiter**: Sliding-window rate limiter protecting login endpoints to prevent brute-force attacks.
- **Session Auto-Logout warning dialog**: Client-side timeout dialog prompting at 28 minutes of inactivity, with a 120-second countdown to automatic logout.
- **Extensible Backup Storage Driver**: A driver interface (`BackupStorageDriver`) with a `LocalDiskBackupDriver` implementation.
- **Backup Verification**: Automatic restore checks verifying the schema integrity, table counts, and record presence.
- **Extensible Health Provider**: A provider interface (`SystemHealthProvider`) with a `LocalHealthProvider` returning real CPU load, database sizing, active users, and system variables.
- **Notification State Statuses**: Enums supporting `UNREAD`, `READ`, and `ARCHIVED` statuses to prevent notification lists from bloating.

### Fixed
- Fixed typescript compilation parallel route clashes by pruning duplicate pages.
- Corrected Prisma transaction timeouts in bulk imports by increasing execution bounds to 60 seconds.
