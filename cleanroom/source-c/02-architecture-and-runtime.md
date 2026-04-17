# Source C — architecture and runtime

## Stack

- **Language:** PHP with section-oriented modules under `app/` (subnets, VLANs, VRFs, dashboard, admin, login, JSON API, SAML2, upgrade paths).
- **Database:** **MySQL/MariaDB**; modern releases expect **utf8mb4** and **CTE** support for advanced queries.
- **Front end:** **jQuery/Ajax** patterns; assets under `css/` and `js/` (Bootstrap, tables, CKEditor, uploaders).

## Deployment

- Community **Docker** images documented on project hub.
- Behind reverse proxies, **forwarded header** trust must be configured deliberately to avoid redirect loops—documented in README.

## Request model

**Monolithic PHP:** many entry scripts per feature area rather than a single framework front controller—simple to host on shared Apache/Nginx + PHP-FPM environments.
