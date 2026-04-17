# Source E — architecture and runtime

## Packaging

- **Core IP management** extension: on the order of **100+ PHP modules** integrating with iTop datamodel hooks and UI.
- **Zone management** extension: adds **DNS views, zones, records** tied to IP and CMDB objects.

## Runtime

Runs wherever **iTop** runs: **Apache/IIS**, **MySQL/MariaDB**, **PHP**—documented for multiple OS targets on the project wiki.

## Coupling

All persistence, authentication, and navigation shells flow through **iTop** core—TeemIP modules extend classes and dictionaries defined by the host product.
