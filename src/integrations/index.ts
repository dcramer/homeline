import pino from "pino";

import { Broker, MessageCallback } from "../broker";

type IntegrationOptions = {
  debug?: boolean;
  deviceUuid: string;
};

type IntegrationConfig = {
  [name: string]: any;
};

type State = {
  [name: string]: any;
};

export class Integration {
  private _broker: Broker;
  private _state: State = {};

  public readonly logger: pino.Logger;
  public readonly deviceUuid: string;
  public readonly config: IntegrationConfig = {};

  constructor(
    broker: Broker,
    { deviceUuid, debug = false }: IntegrationOptions,
    config: IntegrationConfig = {}
  ) {
    this._broker = broker;
    this._state = {};

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
    this._broker.subscribe(topic, callback);
  }

  async publish(topic: string, message: any) {
    this._broker.publish(topic, message);
  }

  log(message: any): void {
    this.logger.info(message);
  }

  error(message: any): void {
    this.logger.error(message);
  }

  async setState(state: State) {
    Object.keys(state).forEach((key) => {
      this._state[key] = state[key];
    });
  }

  async getState(callback: (state: State) => void) {
    callback(this._state);
  }
}
