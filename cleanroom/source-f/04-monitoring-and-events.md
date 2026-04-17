# Source F — monitoring and events

## Polling

**ipdevpoll** drives periodic SNMP walks—device facts, interfaces, ARP/CAM, environmental sensors depending on profiles.

## Alerts

**alertengine** correlates events into operator notifications; **eventengine** processes internal event streams—distinct architecture from Source A’s **broker** pattern but same operational intent (surface changes).

## Metrics

**metrics** subsystem integrates time-series display—complements dashboard UX.

## Traps

**snmptrapd** ingests asynchronous device signals for incident response.
