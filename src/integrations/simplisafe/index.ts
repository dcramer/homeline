import { CommandCallback, Integration } from "../";
import { AGENT } from "../../version";

import SimpliSafeApi, {
  AlarmState,
  SimpliSafeAuthError,
  SimpliSafeToken,
} from "./api";
import SimpliSafeStream from "./stream";
import { SimpliSafeEvent, EventType } from "./event";

const APP_VERSION = "1.62.0";

enum State {
  authenticating,
  pending_mfa,
  ready,
}

class UnknownCommand extends Error {}

// TODO(dcramer): this is the equiv of docs right now, but it'd be great to explain to the
// system that we will use this type for the getState()/setState() abstractions.
type SimpliSafeState = {
  token?: SimpliSafeToken;
  userId?: string;
  defaultSystemId?: string;
};

export default class SimpliSafeIntegration extends Integration {
  readonly #topicPrefix: string = "simplisafe";

  #state?: State;

  #api: SimpliSafeApi = new SimpliSafeApi({
    clientId: AGENT,
  });

  #stream: SimpliSafeStream = new SimpliSafeStream();

  async init() {
    this.#stream.on("event", this.onSimpliSafeEvent);

    this.#state = State.authenticating;
    const { token } = await this.getState();
    this.#api.setAccessToken(token);
    this.#api.on("token", async (value) => {
      await this.setState({ token: value });
      await this.onAccessToken();
    });
    if (token) {
      await this.onAccessToken();
    } else {
      await this.authenticate();
    }

    await this.routeCommand(
      `simplisafe/uid/<userId>/sid/<systemId>/cmd`,
      this.onSystemCommand
    );
    // this.route(
    //   `simplisafe/uid/<userId>/sid/<systemId>/sensor/<sensorSerial>/+/cmd`,
    //   this.onSensorCommand
    // );
  }

  onSystemCommand: CommandCallback = async ({ params }, payload) => {
    switch (payload.name) {
      case "arm_home":
        this.#api.setAlarmState(params.systemId, AlarmState.home);
        break;
      case "arm_away":
        this.#api.setAlarmState(params.systemId, AlarmState.away);
        break;
      case "disarm":
        this.#api.setAlarmState(params.systemId, AlarmState.off);
        break;
      default:
        throw new UnknownCommand(payload.name);
    }
  };

  formatTopicName = (name: string) =>
    name.toString().replace(/[_\s]/g, "-").toLowerCase();

  onAccessToken = async () => {
    let userId: string;

    try {
      userId = (await this.#api.verifyAuth()).userId;
      await this.setState({
        userId,
      });
      this.#state = State.ready;
    } catch (err) {
      if (err instanceof SimpliSafeAuthError) {
        this.logger.info("Access token was invalid; Re-authenticating");
        this.#state = State.authenticating;
        this.#api.setAccessToken();
        await this.authenticate();
      } else {
        this.logger.error(err);
      }
      return;
    }

    if (this.#state === State.ready) {
      await this.onReady();
    }
  };

  onReady = async () => {
    const { token, userId } = await this.getState();
    this.logger.info(`Authenticated as user ID: ${userId}`);
    this.#stream.init(token.accessToken, userId, this.logger);
    const systems = await this.#api.getSystems(userId);
    // TODO(dcramer): why can systems be undefined? is this a promise concept i dont grok?
    if (systems!.length > 0) {
      this.setState({ defaultSystemId: systems![0].sid });
    }
    this.logger.info(
      `Discovered ${systems.length} system(s) - IDs: ${systems
        .map((s) => s.sid)
        .join(", ")}`
    );
  };

  onSimpliSafeEvent = async (event: SimpliSafeEvent) => {
    let topic = `${this.#topicPrefix}/uid/${event.userId}/sid/${event.sid}`;
    if (event.sensorName) {
      topic += `/sensor/${event.sensorSerial}/${event.sensorName}`;
    }
    topic += `/${EventType[event.type]}`;

    await this.publish(this.formatTopicName(topic), event);
  };

  async authenticate() {
    try {
      const result = await this.#api.authenticate({
        grant_type: "password",
        username: this.config.username,
        password: this.config.password,
        app_version: APP_VERSION,
        device_id: `${AGENT} (${this.deviceUuid})`,
      });

      if (result.status === "authenticated") {
        // this path is handled via the token callback
      } else if (result.status === "pending_mfa") {
        this.#state = State.pending_mfa;

        this.logger.info(
          "Check your email for an MFA link to complete authentication with SimpliSafe."
        );
      }
    } catch (err) {
      this.logger.error(`Authentication failed: ${err}`);
    }
  }
}
