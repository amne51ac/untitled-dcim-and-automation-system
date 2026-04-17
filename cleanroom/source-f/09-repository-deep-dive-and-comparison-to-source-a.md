# Source F — repository deep dive and comparison to Source A

## Scale

Thousands of files—**mature NMS** footprint with collectors, web, and models deeply intertwined.

## Truth model

| Source F | Source A |
|----------|----------|
| **Observed** (SNMP, traps, metrics) | **Intended** (design, approvals, jobs) |
| **Polling intervals** | **Authoritative records** for automation |
| **Alerts first** | **APIs and Git** first |

## Coexistence pattern

Common architecture: Source A holds **what should be**; Source F shows **what is** and **whether it alarms**. Integrate via APIs or shared discovery.
