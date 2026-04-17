# Source B — domain models and capabilities

## Design philosophy

The product emphasizes a **ready-made graph** of network primitives (facilities, devices, interfaces, cables, prefixes, addresses, VLANs, circuits, power, VPN, wireless, virtualization) rather than requiring operators to design schemas from scratch.

## DCIM and facilities

Racks, devices, device types, modules, cabling, power paths, and related templates support **physical and logical** network documentation.

## IPAM

Namespaces, VRFs, prefixes, addresses, VLANs, and services—aligned with routing and switching operations.

## Circuits and providers

WAN links, circuit types, provider networks—terminations tie into the cable/path model.

## Virtualization and overlays

Clusters, virtual machines, and interfaces bridge compute inventory to physical attachments.

## Cross-cutting classification

Custom fields, tags, tenants, roles, statuses—support policy and reporting without schema forks for every attribute.

## Automation-oriented features

- **Configuration rendering** from Jinja-style templates (including Git-backed sources in documented flows).
- **Custom scripts** and **reports** as first-class content run from the UI, executed via worker infrastructure.
- **Event rules** that trigger scripts or outbound HTTP notifications on lifecycle changes.

## Change accountability

Automatic **change logging** with **request correlation** so bulk edits group cleanly in audit history.
