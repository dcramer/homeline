import pino from "pino";

import { Broker, MessageCallback } from "../broker";

type IntegrationOptions = {
  debug?: boolean;
  deviceUUID: string;
};

type IntegrationConfig = {
  [name: string]: any;
};

export class Integration {
  private broker: Broker;

  public readonly logger: pino.Logger;
  public readonly deviceUUID: string;
  public readonly config: IntegrationConfig = {};

  constructor(
    broker: Broker,
    { deviceUUID, debug = false }: IntegrationOptions,
    config: IntegrationConfig = {}
  ) {
    this.broker = broker;
    this.config = config;
    this.deviceUUID = deviceUUID;

    this.logger = pino({
      name: this.constructor.name,
      prettyPrint: debug ? { colorize: true } : undefined,
    });
  }

  init(): void {}

  destroy(): void {}

  subscribe(topic: string, callback: MessageCallback): void {
    this.broker.subscribe(topic, callback);
  }

  publish(topic: string, message: any): void {
    this.broker.publish(topic, message);
  }

  log(message: any): void {
    this.logger.info(message);
  }

  error(message: any): void {
    this.logger.error(message);
  }
}
