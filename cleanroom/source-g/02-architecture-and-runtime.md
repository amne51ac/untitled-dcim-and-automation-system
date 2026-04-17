# Source G — architecture and runtime

## Stack

- **PHP** with many **top-level scripts** per feature (cabinets, devices, power, reports, etc.).
- **Composer** **vendor** tree includes spreadsheet, PDF, SAML/OIDC, mail, HTTP clients—**reporting and SSO** readiness.

## Database

**MySQL/MariaDB** via PDO—configuration in `db.inc.php` pattern per README.

## Deployment

**Apache + PHP** with optional **PHP-FPM**; Docker notes for development environments.
