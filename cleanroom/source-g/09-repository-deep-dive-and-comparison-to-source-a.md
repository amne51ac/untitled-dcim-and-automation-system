# Source G — repository deep dive and comparison to Source A

## Repository shape

Large **vendor/** tree plus many **root PHP** scripts—**mature PHP DCIM** codebase focused on **reports and facility objects**.

## Comparison

| Topic | Source G | Source A |
|-------|----------|----------|
| **Focus** | Facility power/rack/cable | Full network domain + automation |
| **APIs** | Limited first-class API story | REST, GraphQL, webhooks |
| **Automation** | Scripts/DB | Jobs, Git, Celery, events |
| **License** | GPLv3 | Apache 2.0 (Source A upstream) |

## Greenfield takeaway

Mine Source G for **facility reporting** and **power/cabinet** UX patterns; use Source A for **network-wide SoT + automation**.
