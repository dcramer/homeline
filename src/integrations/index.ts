import pino from "pino";

import { Broker, MessageCallback } from "../broker";
import { State, Store } from "../store";

type IntegrationOptions = {
  debug?: boolean;
  deviceUuid: string;
};

type IntegrationConfig = {
  [name: string]: any;
};

export class Integration {
  #broker: Broker;
  #state: State = {};
  #store: Store;

  public readonly logger: pino.Logger;
  public readonly deviceUuid: string;
  public readonly config: IntegrationConfig = {};

  constructor(
    broker: Broker,
    store: Store,
    { deviceUuid, debug = false }: IntegrationOptions,
    config: IntegrationConfig = {}
  ) {
    this.#broker = broker;
    this.#store = store;

    this.config = config;
    this.deviceUuid = deviceUuid;

    this.logger = pino({
      name: this.constructor.name,
      prettyPrint: debug ? { colorize: true } : undefined,
    });
  }

  async init() {}

  async destroy() {}

  async subscribe(topic: string, callback: MessageCallback) {
    this.#broker.subscribe(topic, callback);
  }

  async publish(topic: string, message: any) {
    this.#broker.publish(topic, message);
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
