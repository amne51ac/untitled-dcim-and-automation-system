# Source H — architecture and runtime

## Layout

- **`wwwroot/`** entry with **`inc/`** includes: **init**, **database**, **auth**, **navigation**, **functions**, **dictionary**, **caching**, **upgrade**.
- **Procedural PHP** with SQL-backed tables—predates modern PHP frameworks.

## Stack

**Apache** + **PHP** + **MySQL/MariaDB** per README; UTF-8 configuration notes vary by distribution.

## Extension

Hooks and schema evolve through **upgrade** scripts in `inc/upgrade.php` lineage.
