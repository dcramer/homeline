import mqtt from "mqtt";
import pino from "pino";

import { AGENT } from "./version";

type ShutdownOptions = {
  cleanup?: boolean;
  exit?: boolean;
};

type BrokerOptions = {
  debug?: boolean;
};

export type MessageCallback = (message: any, topic: string) => void;

export type Subscription = [string, MessageCallback];

export class Broker {
  #host: string;
  #client?: mqtt.Client;
  #subscribers: Subscription[];
  #debug: boolean;
  #logger: pino.Logger;

  constructor(
    host: string = "localhost:1833",
    { debug = false }: BrokerOptions = {}
  ) {
    this.#host = host;
    this.#subscribers = [];
    this.#debug = debug;

    this.#logger = pino({
      name: "broker",
      prettyPrint: this.#debug ? { colorize: true } : undefined,
    });
  }

  public init() {
    if (this.#client) return;

    this.#logger.info(`connecting to broker on mqtt://${this.#host}`);

    this.#client = mqtt.connect(`mqtt://${this.#host}`, {
      clientId: `${AGENT}_${Math.random().toString(16).substr(2, 8)}`,
      protocolId: "MQIsdp",
      protocolVersion: 3,
    });

    this.#client.on("error", (err: any) => {
      this.#logger.error(err);
    });

    this.#client.on("close", () => {
      this.#logger.info(`disconnected: closed`);
    });

    this.#client.on("disconnect", () => {
      this.#logger.info(`disconnected: packet`);
    });

    this.#client.on("reconnect", () => {
      this.#logger.info(`reconnecting`);
    });

    this.#client.on("connect", (packet: any) => {
      this.#logger.info("connected");
      const topics = new Set(this.#subscribers.map(([t]) => t));
      topics.forEach((t) => {
        this.#logger.info(`subscribe to ${t}`);
        this.#client!.subscribe(t);
      });
      this.#client!.publish("homeline/connected", "true");
    });

    this.#client.on("message", (topic: string, message: any) => {
      this.#logger.debug(`< ${topic}`);
      this.#subscribers.forEach(([t, cb]) => {
        if (topic === t) {
          try {
            cb(message, topic);
          } catch (err) {
            console.error(`[mqtt] error with message callback: ${err}`);
          }
        }
      });
    });

    const onShutdown = (
      { cleanup, exit }: ShutdownOptions,
      err: Error | undefined = undefined
    ) => {
      if (err) {
        this.#logger.error(err);
      }

      if (cleanup) {
        this.#client?.publish("homeline/connected", "false");
      }

      if (exit) {
        process.exit();
      }
    };

    /**
     * Handle the different ways an application can shutdown
     */
    process.on("exit", () => onShutdown({ cleanup: true }));
    process.on("uncaughtException", () => onShutdown({ exit: true }));
    process.on("SIGINT", () => onShutdown({ exit: true }));
  }

  public destroy() {}

  public subscribe(topic: string, callback: MessageCallback) {
    this.#subscribers.push([topic, callback]);
  }

  public unsubscribe(topic: string, callback: MessageCallback) {
    this.#subscribers = this.#subscribers.filter(([t, cb]) => {
      return t !== topic || cb !== callback;
    });
  }

  public publish(topic: string, message: string | Buffer) {
    this.#logger.debug(`> ${topic}`);
    this.#client!.publish(topic, message);
  }
}
