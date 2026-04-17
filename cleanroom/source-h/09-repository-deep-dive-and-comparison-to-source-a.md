# Source H — repository deep dive and comparison to Source A

## Scale

Compact **`inc/`** core versus thousands of modules in Source A—**intentionally minimal**.

## Comparison

| Dimension | Source H | Source A |
|-----------|----------|----------|
| **Problem** | Rack tables + cables | Network SoT + automation |
| **APIs** | Minimal | REST + GraphQL + webhooks |
| **Jobs/events** | None as platform | First-class |
| **Domain breadth** | Physical focus | DCIM + IPAM + circuits + cloud + … |

## Greenfield takeaway

Use Source H as a **historical minimal DCIM** reference for **simplicity**. Use Source A when building a **modern network inventory and automation** product.
