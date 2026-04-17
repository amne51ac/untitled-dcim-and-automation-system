# Source H — security and governance

## Authentication

**inc/auth.php** manages sessions and login—classic PHP patterns; harden TLS and session cookies in production.

## Permissions

Role and object permissions typically enforced in PHP layer—review upstream for RBAC depth.

## Governance

Suitable for **internal** teams; enterprise SSO may require **custom** integration unlike Source A’s OAuth/SSO modules.
