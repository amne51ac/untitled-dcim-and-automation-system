# Source Application A — domain model catalog

This catalog lists **first-party persistent models and key join tables** inferred from model module exports and class declarations. Names follow the upstream public schema vocabulary so readers can correlate documentation with behavior; **no field-level schemas** are reproduced here.

## DCIM (device and facility inventory)

**Location taxonomy:** location types, locations (hierarchical).

**Racks:** rack groups, racks, rack reservations.

**Manufacturing and software identity:** manufacturers, device families, device types, device type to software image file associations, platforms, software image files, software versions.

**Devices:** devices, device redundancy groups, device cluster assignments, virtual chassis, virtual device contexts, interface assignments to virtual device contexts.

**Modules:** module families, module types, modules, module bays and bay templates.

**Components and templates:** console, power, interface, front/rear ports and outlets; device bays; inventory items; parallel **template** models for device types; cables and cable paths; interface redundancy groups and their associations.

**Power:** power panels, power feeds.

**Controllers and wireless-oriented groupings:** controllers, controller-managed device groups.

## IPAM

**Routing context:** namespaces, VRFs, VRF device assignments, VRF prefix assignments, route targets, RIRs (registry organizations for IP allocation authority).

**Addressing:** prefixes, prefix-to-location assignments, IP addresses, IP-address-to-interface associations.

**Layer 2:** VLAN groups, VLANs, VLAN location assignments.

**Services:** network services (protocol and port semantics attached to address or device context as designed).

## Circuits

Provider networks, providers, circuit types, circuits, circuit terminations (including path and cable integration).

## Virtualization

Cluster types, cluster groups, clusters, virtual machines, VM interfaces (aligned with DCIM interface abstractions).

## Cloud

Cloud accounts, cloud resource types (including mixin for typed resources), cloud networks, cloud services, and join tables linking networks to prefixes and services to networks.

## Load balancing

Virtual servers, load balancer pools, pool members, health check monitors, certificate profiles, and join tables binding certificates to virtual servers and pool members.

## VPN

VPN phase-one and phase-two policy objects, VPN profiles (with optional assignments to policies), VPN instances, VPN tunnels, tunnel endpoints, VPN terminations, and profile-to-policy assignment tables.

## Wireless

Supported data rates, radio profiles, wireless networks, and join tables associating controller-managed device groups with wireless networks and radio profiles.

## Tenancy

Tenant groups (tree-shaped organizational model), tenants.

## Users and access control

Extended user accounts, admin-oriented group subclass, long-lived API tokens, object permissions (including change logging on the permission records themselves).

## Extras (platform layer)

**Change logging:** abstract change-logged model behavior, object change records.

**Approvals:** workflow definitions, stage definitions, runtime workflow instances, stages, per-stage responses.

**Contacts:** contacts, teams, contact associations to arbitrary objects.

**Custom data:** custom fields and choices, computed fields, config contexts, config context schemas, custom links, export templates, metadata types and choices, object metadata, notes, saved views and user associations.

**Groups:** dynamic groups, static group associations, cached membership records where applicable.

**Relationships:** relationship definitions, associations, mixin for models participating in the feature.

**Jobs:** job definitions, job queues and queue assignments, job results, job log entries, job console entries, scheduled jobs and grouping records, job buttons, job hooks.

**Integration:** Git repositories, webhooks, external integrations, GraphQL query storage, file attachments and proxies, image attachments, health-check test hook model.

**Classification:** roles, statuses, tags and tagged item bindings.

**Secrets:** secrets, secrets groups, secrets group associations.

## Data validation

Regular expression, numeric min/max, required-field, and unique-value rules sharing a common mixin, plus a **data compliance** aggregate type that participates in dynamic groups, notes, and saved views.

## Observations for implementers

- **Primary vs organizational vs base** model patterns recur: some tables exist only for taxonomy (types, groups), others carry operational inventory, and join tables normalize many-to-many or scoped assignments (VRFs to prefixes, VLANs to locations, etc.).
- **Extras** intentionally centralizes cross-cutting concerns so domain apps stay focused on networking entities.
- **VPN** and **wireless** modules use explicit assignment tables where a many-to-many or scoped association would otherwise obscure business rules.
