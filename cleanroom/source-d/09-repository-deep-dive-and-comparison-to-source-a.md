# Source D — repository deep dive and comparison to Source A

## Repository shape

Large **src/ralph** tree with many first-party apps and **lib** utilities—mature **CMDB-grade** codebase.

## Headline differences

| Topic | Source D | Source A |
|-------|----------|----------|
| **Primary entity** | **Asset** with financial lifecycle | **Network intent** (devices, prefixes, circuits, …) with automation hooks |
| **Workflow** | **Transitions** / operations-heavy | **Jobs**, **approvals**, **hooks** |
| **Visualization** | **dc_view**, dashboards | DCIM views + **cloud/LB/VPN** graphs |
| **Network depth** | DNS/DHCP apps exist; breadth varies | Native **multi-domain** network models |

## When to reference Source D

Use for **asset lifecycle**, **procurement**, and **DC floor** UX patterns. Use Source A for **network automation platform** and **API-first SoT** that drives config pipelines.
