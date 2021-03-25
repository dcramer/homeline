import mqtt from "mqtt";
import pino from "pino";

import { Broker, MessageCallback } from "../broker";
import { State, Store } from "../store";
import { AGENT } from "../version";

type IntegrationOptions = {
  debug?: boolean;
  mqttHost: string;
  store: Store;
  deviceUuid: string;
};

type IntegrationConfig = {
  [name: string]: any;
};

type LastWill = {
  topic: string;
  payload: string;
};

export class Integration {
  #store: Store;
  #mqtt: mqtt.Client;
  #name: string;

  public readonly logger: pino.Logger;
  public readonly deviceUuid: string;
  public readonly config: IntegrationConfig = {};

  constructor(
    { deviceUuid, mqttHost, store, debug = false }: IntegrationOptions,
    config: IntegrationConfig = {}
  ) {
    this.#store = store;
    this.#name = this.getCanonicalName();

    this.config = config;
    this.deviceUuid = deviceUuid;

    this.logger = pino({
      name: this.#name,
      level: debug ? "debug" : "info",
      prettyPrint: debug ? { colorize: true } : undefined,
    });

    const lastWill = this.getLastWill();

    this.#mqtt = mqtt.connect(`mqtt://${mqttHost}`, {
      clientId: `${AGENT}/_${Math.random().toString(16).substr(2, 8)}+${
        this.#name
      }`,
      ...(lastWill
        ? {
            will: {
              qos: 0,
              retain: false,
              ...lastWill,
            },
          }
        : {}),
    });

    this.#mqtt.on("error", (err: any) => {
      this.logger.error(err);
    });

    // this.#mqtt.on("connect", (packet: any) => {
    //   const topics = new Set(this.#subscribers.map(([t]) => t));
    //   topics.forEach((t) => {
    //     this.#logger.info(`subscribe to ${t}`);
    //     this.#client!.subscribe(t);
    //   });
    //   this.publish(`homeline/${this.#deviceUuid}/online`, "", false);
    // });

    this.#mqtt.on("message", (topic: string, message: any) => {
      this.logger.debug(`< ${topic}`);
      try {
        this.onMessage(topic, message);
      } catch (err) {
        this.logger.error(`Error with message callback: ${err}`);
      }
    });
  }

  getCanonicalName() {
    return this.constructor.name.replace(/Integration$/, "").toLowerCase();
  }

  getLastWill(): LastWill | null {
    return null;
  }

  async init() {}

  async destroy() {}

  async onMessage(topic: string, message: string | Buffer) {}

  async subscribe(topic: string) {
    this.logger.debug(`subscribed to ${topic}`);
    this.#mqtt.subscribe(topic);
  }

  async publish(topic: string, message: any, serialize = true) {
    this.logger.debug(`> ${topic}`);
    this.#mqtt.publish(topic, serialize ? JSON.stringify(message) : message);
  }

  log(message: any): void {
    this.logger.info(message);
  }

  error(message: any): void {
    this.logger.error(message);
  }

  async setState(state: State) {
    await this.#store.setState(this.constructor.name, state);
  }

  async getState() {
    return await this.#store.getState(this.constructor.name);
  }
}
