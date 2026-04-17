# Source C — extensibility and customization

## Configuration

Central **config** patterns (per README) control database, authentication mode, proxy trust, and feature toggles—operators customize via PHP config files rather than a Django `settings.py`.

## Admin and sections

**Admin** area manages users, permissions, and application parameters. Feature code lives in **sections** (subnets, tools, etc.) enabling modular maintenance.

## Import and upgrade

**Install** and **upgrade** scripts migrate schema versions; long-lived branches exist for maintenance releases per README.

## Extension philosophy

Compared to Source A’s **plugin marketplace**, Source C favors **configuration + built-in modules**; deep custom behavior often means **forking** or **wrapping APIs** externally.
