# Source B — overview and purpose

## Mission

Source B is positioned as the **intended-state** inventory for automated networks: a cohesive data model for racks, devices, cabling, addressing, circuits, power, and related domains, exposed through **web UI** and **programmatic APIs**. Public materials stress that it does **not** replace dedicated monitoring or configuration engines—it **feeds** them.

## Relationship to Source A

Source A’s upstream began as a fork of an earlier release of this codebase. Both share **DCIM/IPAM** lineage. Source A evolved toward a heavier **automation platform** (unified jobs, Git datasources, broader apps ecosystem, Celery, brokered events). Source B remains the **reference Apache 2.0 SoT** with **plugins**, **django-rq**, and **GraphQL (Strawberry stack)** per repository survey.

## License posture

Project metadata indicates **Apache 2.0**, aligning with permissive reuse and commercial embedding subject to license notice requirements.

## Primary audiences

- Network engineering teams modeling **design intent**.
- Automation teams consuming **REST/GraphQL** and **rendered configuration** outputs.
- Operators extending the model via **plugins** and **custom fields** without forking core.
