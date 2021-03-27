# homeline

Homeline is an MQTT-based solution for integrating your connected home devices into your smart home automation software. Instead of maintaining automation-specific integrations, homeline gives you a bridge which can work with any solution (Home Assistant, Homebridge, etc) with a simple and stable base backed by an MQTT broker.

**This is still very much a WIP. If you are interested in contributing, or have feedback, please open an issue!**

## Why

A bit of backstory...

I have a bunch of automations written in AppDaemon that run using Home Assistant. This has allowed me to respond to state and write more complex integrations (such as automatic alarm management based on other information), that are otherwise difficult with the native controls in HA. These integrations howerver are only as stable as the code which powers them, which is bundled into Home Assistant's open source repo. They're often hard to debug, a mixed bag of code quality, and tightly coupled to the core of HASS (meaning they need maintained). So problem number one: build a more stable integration for the core services I use.

Problem number two came down to the fact that I have a Luxor system for exterior lighting. There's not currently a Home Assistant integration, but there _is_ a Homebridge one. Immediately I had to ask myself, why do we have to re-build third party integrations for every platform? I'd love to use the Homebridge integration (specifically the Luxor integration) as part of Home Assistant, but that requires me to wire up Homebridge - non-trivial as I already use a different Homekit integration - or to extract it and roll my own.

So, Homeline was born. The goal is to support an abstraction on device integrations (via MQTT), meaning I can build my own Luxor and SimpliSafe integrations, but have them completely decoupled from e.g. Home Assistant's Python core, or Homebridge's JavaScript core. I can then choose to build a Home Assistant integration which ingests Homeline information, and maintains the ability to register those devices/entities, as well as update their state, and enable service calls. Ultimately, that means my system is as stable as the usptream provider (e.g. SimpliSafe), as the MQTT stream will be completely stable. I have to respond to changes in HA for my singular integration, and respond to changes in the upstream API provider, but I simply them to the same stable stream minimizing the maintenance and breakage.

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

### API

An integration extends the `src/integrations/Integration` class (see examples for details) and manages its own lifecycle from there. It has access to a self-isolated instance of an MQTT client, allowing it to own its own subscriptions, as well as provide a Last Will.

```typescript
class MyIntegration extends Integration {
  init() {}
}
```

A common need is to subscribe to an MQTT topic, for example to allow service calls. To do this a routing abstraction exists similar to traditional web frameworks:

```typescript
type RouteMatch = {
  topic: string;
  pattern: string;
  params: {
    [key: string]: any;
  };
};

class MyIntegration extends Integration {
  init() {
    this.routeCommand(
      "simplisafe/#/sensor/{sensorId}/cmd",
      this.onSensorCommand
    );
  }

  onSensorCommand: CommandCallback = (
    route: RouteMatch,
    payload: CommandPayload
  ) => {
    switch (payload.name) {
      case "command_name":
        const { sensorId } = route.params;
        // do the thing
        break;
    }
  };
}
```

Note: The parameter (`{sensorId}`) maps to only a single-level entry. That is, it is naively replaced by `+` when capturing the topic pattern.

### Last Will

TODO: Need to determine the simplest way to provide last will behavior for entity status.

### Testing

TODO: Need to determine the simplest way to ensure integrations can be tested using fixture data (think Ruby's `vcr` or Python's `responses`). Goal is speed-to-accuracy.

## MQTT Conventions

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

### Commands

As commands (or service calls) are made via MQTT events, they should follow a similar convention as other updates/events, but with a `cmd` suffix notation:

- `simplisafe/uid/54321/sid/12345/cmd`

- `simplisafe/uid/54321/sid/12345/sensor/front-door/cmd`

The topic should include the entity that is being acted on, and the remainder of the parameters will be part of the event payload.

Command payloads are expected to conform to the following schema:

```json
{
  "id": "uuid",
  "name": "command-name",
  "data": {
    "param-name": "param-value"
  }
}
```

Or in typescript notation:

```typescript
type CommandPayload = {
  id?: string;
  name: string;
  data?: {
    [key: string]: any;
  };
};
```

#### Command Errors

Errors from commands - when possible - will be routed to the following topic:

`[original-command-topic]/cid/[command-id]/error`

If a command ID is not present in the original payload, the topic will be truncated to:

`[original-command-topic]/error`

As an example, an error topic may look like the following:

`simplisafe/uid/54321/sid/12345/sensor/front-door/cmd/error`

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
