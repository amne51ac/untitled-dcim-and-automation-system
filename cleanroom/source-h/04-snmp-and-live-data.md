# Source H — SNMP and live data

## SNMP module

**inc/snmp.php** supports pulling **live** data for some workflows—**augmentation** of static records, not full polling like Source F.

## Remote access

**remote.php** suggests remote query or integration hooks—verify upstream docs for supported protocols.

## Contrast

Source A does **not** replace NMS; Source H **optionally** touches SNMP for inventory enrichment—different scale and purpose than Source F.
