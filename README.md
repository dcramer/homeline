# homeline

Homeline is an MQTT-based solution for integrating your connected home devices into your smart home automation software. Instead of maintaining automation-specific integrations, homeline gives you a bridge which can work with any solution (Home Assistant, Homebridge, etc) with a simple and stable base backed by an MQTT broker.

**This is still very much a WIP. If you are interested in contributing, or have feedback, please open an issue!**

## Integrations

Integrations are written as simple classes that contain the ability to both publish and receive messages from an MQTT broker. In general, they are made up of two core patterns:

- Ingesting data from an upstream source (such as websockets), to translate into MQTT data
- Translating MQTT service calls into upstream API calls

Integrations are typescript modules, currently packaged in the `integrations/` directory. Eventually these will be loadable anywhere (as long as they are a node module), and configured via the `config.yml` file. Eventually, we expect configuration to look like the following:

```yaml
integrations:
  - id: identifier
    module: npm-package
    # module: ./path/to/npm-package
    config:
      username: foo
      password: bar
```

- Configuration is a list to allow control over load order.
- The `id` will primarily be used for internal references, such as logging.
- The `module` param will allow either a known npm module (e.g. valid in `node_modules` via `npm install`) or a path on disk to a valid module.

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

## Entity Specifications

TODO:

This likely looks like a spec, including a fixed topic? to publish entities into known schemas so that a generic Home Assistant plugin can pick them up and register them appropriately.

e.g.

```json
{
  "type": "light",
  "state": "on"
}
```
