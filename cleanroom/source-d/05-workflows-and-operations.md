# Source D — workflows and operations

## Lifecycle

Asset movement through states (warehouse → rack → decommission) is a **first-class** problem—**operations** and **transitions** libraries reinforce this.

## Notifications

**notifications** app coordinates operator alerts—distinct from Source A’s **event brokers** but similar operational goal.

## Import/export

**data_importer** supports bulk loads—critical for CMDB bootstrapping from spreadsheets or external systems.

## Configuration management tie-in

**configuration_management** naming indicates alignment between documented configs and assets where the deployment uses that module.
