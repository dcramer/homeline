# homeline

Homeline is an MQTT-based solution for integrating your connected home devices into your smart home automation software. Instead of maintaining automation-specific integrations, homeline gives you a bridge which can work with any solution (Home Assistant, Homebridge, etc) with a simple and stable base backed by an MQTT broker.

**This is still very much a WIP. If you are interested in contributing, or have feedback, please open an issue!**

## Topic Naming Conventions

Topic naming in MQTT is a grab bag, so this is our take on it.

Topics should be made up of the following components, in order:

- the service name (e.g. `simplisafe`)
- the system terminology (e.g. `system-id` or `sid`)
- the system identifier (e.g. `12345`)
- if applicable, the type of entity (e.g. `sensor`)
- if applicable, the identifier of an entity (e.g. `my-doorbell`)
- if applicable, the type of event (e.g. `ring`)

All topic names should be:

- lowercased
- limited to a-z, 0-9, and - characters

For example, an update for a simplisafe door being unlocked:

- `simplisafe/sid/12345/sensor/front-door/lock-unlocked`

Or, the alarm being triggered:

- `simplisafe/sid/12345/alarm-triggered`

### Service Calls

As service calls are made via MQTT events, they should follow a similar convention as other updates/events, but with a `cmd` notation:

- `simplisafe/sid/12345/cmd`

- `simplisafe/sid/12345/sensor/front-door/cmd`

The topic should include the entity that is being acted on, and the remainder of the parameters will be part of the event payload.
