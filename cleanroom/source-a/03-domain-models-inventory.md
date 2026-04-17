# Source Application A — domain model inventory

This section groups **major areas** of the core data model. Names are generic labels for capability areas; they align with how the upstream product partitions Django apps and user documentation.

## Facilities and physical infrastructure (DCIM-style)

- **Locations** are organized using configurable **location types** and hierarchies (for example region → site → building → floor).
- **Racks** and **rack reservations** model physical placement; **devices** mount in racks with face and position semantics.
- **Cables** and **interfaces** model physical and logical connectivity between devices; **console** and **power** port concepts exist.
- **Devices** reference **device types**, **roles**, **platforms**, and **manufacturers** to normalize hardware and software identity.
- **Virtual chassis** and **device redundancy groups** model multi-chassis and HA groupings.
- **Controllers** and **controller-managed device groups** support appliance/controller relationships (including wireless-oriented workflows).

## IP addressing and VLANs (IPAM-style)

- **Namespaces** and **VRFs** scope routing domains.
- **Prefixes** form a hierarchy; **IP addresses** attach to interfaces or stand alone; **services** can be modeled with protocol and port.
- **VLANs** and **VLAN groups** tie Layer 2 identifiers to sites and locations.
- Tools exist for **merging** overlapping or duplicate IP data under controlled workflows.

## Circuits and providers

- **Providers** and **circuits** model WAN links and handoffs, including termination points that can relate to sites or cloud constructs.

## Virtualization

- **Clusters**, **virtual machines**, and related objects tie compute workloads to the physical inventory where documented.

## Cloud resources

- **Cloud accounts** anchor workloads to providers (linked to manufacturer-style provider records).
- **Cloud networks** and **cloud services** describe VPC-class networks, attached prefixes, and service endpoints.
- **Resource types** classify which cloud object kinds exist per provider.
- Relationships tie cloud objects to **circuits** (for example direct connect style patterns) and to other inventory.

## Load balancing

Vendor-neutral models describe **virtual servers** (front-end VIP and listener concept), **pools**, **pool members**, **health checks**, and **certificate profiles**, with links into IPAM and DCIM and optional cloud linkage.

## VPN

Models represent **VPN profiles**, **phase-one and phase-two policy** parameters, **tunnels**, and **endpoints**, with optional tenant and secrets associations. Documentation positions this as **tunnel-style** VPN representation first; overlay-only concepts may evolve separately.

## Wireless (campus-oriented)

Models cover **SSIDs** via wireless networks, **radio profiles** (power, channels, rates), and grouping access points via controller-managed constructs. Scope is described as campus Wi‑Fi workflows rather than full mobile backhaul coverage.

## Tenancy and contacts

- **Tenants** and **tenant groups** partition ownership across many objects.
- **Contacts** and **teams** model people and groups associated with objects for operational handoff.

## Platform-wide supporting objects

- **Status** values and **roles** provide normalized lifecycle and purpose labels across types.
- **Tags** offer lightweight cross-cutting labels.
- **Dynamic groups** define membership by filters, set logic, or static lists, with cached membership for performance.
- **Metadata** and **notes** attach structured or free-form commentary to objects.
- **Secrets** and **secrets groups** abstract credentials for integrations (for example Git remotes or external APIs) without storing raw secrets in arbitrary fields.

## Extensibility on top of core models

- **Custom fields**, **computed fields**, and **relationships** extend the schema without migrations for every new attribute.
- **Config contexts** merge structured JSON/YAML data onto devices and related objects using hierarchical scope rules.

## Magnitude

Documentation cautions that diagrams are simplified; **many** models and join tables exist under the hood. Apps may add more models beyond core.
