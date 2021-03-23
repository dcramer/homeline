import { Broker, Subscription, MessageCallback } from "../broker";

export class Integration {
  private broker: Broker;
  private subscriptions: Subscription[];

  constructor(broker: Broker) {
    this.broker = broker;

    this.subscriptions = [];
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
    console.log(message);
  }

  error(message: any) {
    console.error(message);
  }
}
