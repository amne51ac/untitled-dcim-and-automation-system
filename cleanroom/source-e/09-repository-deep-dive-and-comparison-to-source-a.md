# Source E — repository deep dive and comparison to Source A

## Two-repo survey

**teemip-core-ip-mgmt** owns IP/network/datamodel hooks; **teemip-zone-mgmt** layers DNS authority data—together they approximate **DDI documentation** alongside CMDB.

## Comparison

| Dimension | Source E | Source A |
|-----------|----------|----------|
| **Base** | iTop + PHP extensions | Django monolith |
| **License** | AGPL extensions | Apache 2.0 (Source A upstream) |
| **Network breadth** | Strong IP/DNS; physical DCIM depth varies with iTop | Native DCIM/IPAM/circuits/cloud/LB/VPN |
| **Automation** | REST + ITSM workflows | Jobs, webhooks, Git, Celery, GraphQL |

## Greenfield takeaway

Choose Source E patterns when the product must live inside **ITSM + CMDB**. Choose Source A patterns for a **dedicated network automation SoT**.
