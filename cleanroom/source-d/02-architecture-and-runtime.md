# Source D — architecture and runtime

## Stack

- **Python / Django** with packages under **`src/ralph/`**.
- **Dependencies** include LDAP auth, filters, import/export, money fields, **MPTT** for trees—typical large enterprise Django deployment.

## Major Django apps (package names)

Including but not limited to: **assets**, **data_center**, **dc_view**, **deployment**, **back_office**, **networks**, **dns**, **dhcp**, **domains**, **virtual**, **operations**, **reports**, **notifications**, **security**, **ssl_certificates**, **attachments**, **dashboards**, **accounts**, **admin**, **api**, **data_importer**, **configuration_management**, **supports**, **licences**, **trade_marks**, **sim_cards**, **access_cards**, **accessories**.

## Routing

**`urls/`** package splits routes across attachments, dashboards, deployment, DHCP, reports, accounts, virtual, etc.

## Runtime

Standard WSGI deployment (gunicorn-class) per dependency groups; follow upstream docs for production.
