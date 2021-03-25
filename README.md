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

### Implementation

An integration extends the `src/integrations/Integration` class (see examples for details) and manages its own lifecycle from there. It has access to a self-isolated instance of an MQTT client, allowing it to own its own subscriptions, as well as provide a Last Will.

### Last Will

TODO: Need to determine the simplest way to provide last will behavior for entity status.

### Testing

TODO: Need to determine the simplest way to ensure integrations can be tested using fixture data (think Ruby's `vcr` or Python's `responses`). Goal is speed-to-accuracy.

## Topic Naming Conventions

Topic naming in MQTT is a grab bag, so this is our take on it.

**Note: This spec is in flux based on opinions of folks with more domain experience than myself.**

Topics should be made up of the following components, in order:

- the service name (e.g. `simplisafe`)
- if a user identifier is available..
  - a named constant for the type account (e.g. `uid`)
  - a unique user identifier (e.g. `54321`) - this should be the upstream service user ID
- a named constant for the type of device (e.g. `sid`)
- a unique system identifier (e.g. `12345`) - if unavailable, this will be the device UUID
- if available, the human readable system identifier (e.g. `home`)

When the event is related to an entity (such as a sensor), you should include the following:

- the type of entity (e.g. `sensor`)
- if available, the unique entity identifier (e.g. `13245`)
- if available, the human readable entity identifier (e.g. `front-doorbell`)

And lastly, some indicator for the type of event:

- if applicable, the event name (e.g. `unlocked`)
- otherwise, a generic update (e.g. `state`)

All topic names should be:

- lowercased
- limited to a-z, 0-9, and - characters

For example, an update for a simplisafe door being unlocked:

- `simplisafe/uid/54321/sid/12345/sensor/front-door/lock-unlocked`

Or, the alarm being triggered:

- `simplisafe/uid/54321/sid/12345/alarm-triggered`

### Service Calls

As service calls are made via MQTT events, they should follow a similar convention as other updates/events, but with a `cmd` notation:

- `simplisafe/uid/54321/sid/12345/cmd`

- `simplisafe/uid/54321/sid/12345/sensor/front-door/cmd`

The topic should include the entity that is being acted on, and the remainder of the parameters will be part of the event payload.

### Homeline's Internal Topic

Homeline will publish its events using the following prefix:

`homeline/[device-id]`

For example, when homeline starts up, it will publish:

`homeline/[device-id]/online`

And upon teardown:

`homeline/[device-id]/offline`

TODO: We should publish an integration specific status to the central homeline topic. e.g. `homeline/[device-id]/integration/simplisafe/enabled`

## Entity Specifications

TODO: This likely looks like a spec, including a fixed topic? to publish entities into known schemas so that a generic Home Assistant plugin can pick them up and register them appropriately.

e.g.

```json
{
  "type": "light",
  "state": "on"
}
```

TODO: Look at ESPHome for some prior art, as it has a lot of configurability and has similar kinds of goals.

## Credit

- Whoever did the work to reverse engineer SimpliSafe's API, allowing me to build a POC. Most of the work is heavily influenced by https://github.com/bachya/simplisafe-python.

- Anyone who's shared their opinions on MQTT, how it should work, how it doesn't work, etc.

- Infinite shitty connected devices with terrible APIs, inspiring me to take the matter into my own hands.
