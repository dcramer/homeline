import { Integration } from "../";
import { AGENT } from "../../version";

import SimpliSafeApi from "./api";
import SimpliSafeStream from "./stream";
import { SimpliSafeEvent, EventType } from "./event";

const APP_VERSION = "1.62.0";

enum State {
  authenticating,
  pending_mfa,
  ready,
}

// TODO(dcramer): this is the equiv of docs right now, but it'd be great to explain to the
// system that we will use this type for the getState()/setState() abstractions.
type SimpliSafeState = {
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  defaultSystemId?: string;
};

export default class SimpliSafeIntegration extends Integration {
  // public readonly config: SimpliSafeConfig = {};

  readonly #topicPrefix: string = "simplisafe";
  #state?: State;
  #api: SimpliSafeApi = new SimpliSafeApi({
    clientId: `${AGENT}.WebApp.simplisafe.com`,
  });
  #stream: SimpliSafeStream = new SimpliSafeStream();

  #ssDeviceId?: string;

  async init() {
    this.#ssDeviceId = `WebApp; useragent="Safari 13.1 (SS-ID: {0}) / macOS 10.15.6"; uuid="${this.deviceUuid}"; id="${AGENT}"`;

    this.#stream.on("event", this.onSimpliSafeEvent);

    this.#state = State.authenticating;
    const { accessToken } = await this.getState();
    if (accessToken) {
      try {
        const { userId } = await this.#api.verifyAuth(accessToken);
        await this.setState({ userId });
        this.#state = State.ready;
        this.#stream.init(accessToken, userId, this.logger);
      } catch (err) {
        await this.authenticate();
      }
    } else {
      await this.authenticate();
    }

    if (this.#state === State.ready) {
      await this.onReady();
    }

    this.subscribe(`simplisafe/#/cmd`);
  }

  formatTopicName = (name: string) =>
    name.toString().replace(/[_\s]/g, "-").toLowerCase();

  onReady = async () => {
    this.logger.info("Fetching system configuration");
    const { accessToken, userId } = await this.getState();
    const systems = await this.#api.getSystems(accessToken, userId);
    // TODO(dcramer): why can systems be undefined? is this a promise concept i dont grok?
    if (systems!.length > 0) {
      this.setState({ defaultSystemId: systems![0].sid });
    }
  };

  onMessage = async (topic: string, message: string | Buffer) => {
    // TODO(dcramer): need a convenience feature to parse a topic like a typical set of URL routes
    // aka map simplisafe/sid/{system-id} into myFunctionNamme(args: {"system-id": ""})
    this.logger.info(topic);
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
        device_id: this.#ssDeviceId,
      });

      if (result.status === "authenticated") {
        const { userId } = await this.#api.verifyAuth(
          result.accessToken as string
        );
        await this.setState({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          userId,
        });

        this.#state = State.ready;
        this.#stream.init(result.accessToken as string, userId, this.logger);

        if (this.#state === State.ready) {
          await this.onReady();
        }
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
