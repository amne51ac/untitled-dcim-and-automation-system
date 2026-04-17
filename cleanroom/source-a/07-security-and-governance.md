# Source Application A — security and governance

## Identity

The platform integrates with common Django authentication backends. Deployments may use local accounts, LDAP, SSO/OAuth providers, or other pluggable mechanisms depending on environment configuration. Exact setup is site-specific.

## Authorization model

- **Groups** aggregate users.  
- **Object-level permissions** grant fine-grained access to model instances or filtered subsets, complementing default model permissions.  
- **Staff** and **superuser** flags separate routine operators from platform administrators.  
- Job execution and approval each have distinct permission checks.

## Secrets handling

Sensitive values for Git or integrations are stored via **secrets** records and **secrets groups**, decoupling rotation from job code. UI and API avoid echoing secret contents.

## Auditability

- Domain **change logs** provide forensic history for inventory mutations.  
- **Job results** retain logs, outcomes, and timing for automation.  
- Administrative actions leave traces in admin logs where applicable.

## Data governance features

- **Approval workflows** gate destructive or high-impact jobs.  
- **Validation rules** enforce business policies before writes land.  
- **Required relationships** ensure critical associations cannot be omitted for governed object types.

## Network and transport security

Deployment guidance covers TLS termination, HSTS, trusted proxies, and webhook verification. These are standard operational controls rather than application code concerns.
