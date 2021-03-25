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

export default class SimpliSafeIntegration extends Integration {
  // public readonly config: SimpliSafeConfig = {};

  readonly #topicPrefix: string = "simplisafe";
  #state?: State;
  #api?: SimpliSafeApi;
  #stream: SimpliSafeStream = new SimpliSafeStream();

  #ssDeviceId?: string;

  async init() {
    this.#ssDeviceId = `WebApp; useragent="Safari 13.1 (SS-ID: {0}) / macOS 10.15.6"; uuid="${this.deviceUuid}"; id="${AGENT}"`;

    this.#api = new SimpliSafeApi({
      clientId: `${AGENT}.WebApp.simplisafe.com`,
    });

    this.#stream.on("event", this.onEvent);

    this.#state = State.authenticating;
    const { accessToken } = await this.getState();
    if (accessToken) {
      try {
        const { userId } = await this.#api.verifyAuth(accessToken);
        await this.setState({ userId });
        this.#state = State.ready;
        this.#stream.init(accessToken, userId, this.logger);
      } catch (err) {
        this.authenticate();
      }
    } else {
      this.authenticate();
    }
  }

  formatTopicName = (name: string) =>
    name.toString().replace(/[_\s]/g, "-").toLowerCase();

  onEvent = async (event: SimpliSafeEvent) => {
    let topic = `${this.#topicPrefix}/uid/${event.userId}/sid/${event.sid}`;
    if (event.sensorName) {
      topic += `/sensor/${event.sensorSerial}/${event.sensorName}`;
    }
    topic += `/${EventType[event.type]}`;

    await this.publish(this.formatTopicName(topic), event);
  };

  async authenticate() {
    try {
      const result = await this.#api!.authenticate({
        grant_type: "password",
        username: this.config.username,
        password: this.config.password,
        app_version: APP_VERSION,
        device_id: this.#ssDeviceId,
      });

      if (result.status === "authenticated") {
        const { userId } = await this.#api!.verifyAuth(
          result.accessToken as string
        );
        await this.setState({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          userId,
        });
        this.#state = State.ready;
        this.#stream.init(result.accessToken as string, userId, this.logger);
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
