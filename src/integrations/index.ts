import pino from "pino";

import { Broker, MessageCallback } from "../broker";

type IntegrationOptions = {
  debug?: boolean;
};

export class Integration {
  private broker: Broker;
  private logger: pino.Logger;

  constructor(broker: Broker, { debug = false }: IntegrationOptions = {}) {
    this.broker = broker;

    this.logger = pino({
      name: this.constructor.name,
      prettyPrint: debug ? { colorize: true } : undefined,
    });
  }

  init() {}

  destroy() {}

  subscribe(topic: string, callback: MessageCallback) {
    this.broker.subscribe(topic, callback);
  }

  publish(topic: string, message: any) {
    this.broker.publish(topic, message);
  }

  log(message: any) {
    this.logger.info(message);
  }

  error(message: any) {
    this.logger.error(message);
  }
}
