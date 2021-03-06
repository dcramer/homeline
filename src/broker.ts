import mqtt from "mqtt";
import pino from "pino";

import { AGENT } from "./version";

type ShutdownOptions = {
  cleanup?: boolean;
  exit?: boolean;
};

type BrokerOptions = {
  debug?: boolean;
  deviceId: string;
};

export type MessageCallback = (message: any, topic: string) => void;

export type Subscription = [string, MessageCallback];

export class Broker {
  #host: string;
  #client?: mqtt.Client;
  #subscribers: Subscription[];
  #debug: boolean;
  #deviceId: string;
  #logger: pino.Logger;

  constructor(
    host: string = "localhost:1833",
    { deviceId, debug = false }: BrokerOptions
  ) {
    this.#host = host;
    this.#subscribers = [];
    this.#debug = debug;
    this.#deviceId = deviceId;

    this.#logger = pino({
      name: "broker",
      level: debug ? "debug" : "info",
      prettyPrint: debug ? { colorize: true } : undefined,
    });
  }

  init() {
    if (this.#client) return;

    this.#logger.info(`Connecting to broker on mqtt://${this.#host}`);

    this.#client = mqtt.connect(`mqtt://${this.#host}`, {
      clientId: `${AGENT}_${Math.random().toString(16).substr(2, 8)}`,
      will: {
        topic: `homeline/${this.#deviceId}/offline`,
        payload: "",
        qos: 0,
        retain: false,
      },
    });

    this.#client.on("error", (err: any) => {
      this.#logger.error(err);
    });

    this.#client.on("close", () => {
      this.#logger.info(`Disconnected: closed`);
    });

    this.#client.on("disconnect", () => {
      this.#logger.info(`Disconnected: packet`);
    });

    this.#client.on("reconnect", () => {
      this.#logger.info(`Reconnecting`);
    });

    this.#client.on("connect", (packet: any) => {
      this.#logger.info("Connected");
      const topics = new Set(this.#subscribers.map(([t]) => t));
      topics.forEach((t) => {
        this.#logger.info(`subscribe to ${t}`);
        this.#client!.subscribe(t);
      });
      this.publish(`homeline/${this.#deviceId}/online`, "", false);
    });

    this.#client.on("message", (topic: string, message: any) => {
      this.#logger.debug(`< ${topic}`);
      this.#subscribers.forEach(([t, cb]) => {
        if (topic === t) {
          try {
            cb(message, topic);
          } catch (err) {
            this.#logger.error(`Error with message callback: ${err}`);
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
        this.publish(`homeline/${this.#deviceId}/offline`, "", false);
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

  subscribe(topic: string, callback: MessageCallback) {
    this.#subscribers.push([topic, callback]);
  }

  unsubscribe(topic: string, callback: MessageCallback) {
    this.#subscribers = this.#subscribers.filter(([t, cb]) => {
      return t !== topic || cb !== callback;
    });
  }

  publish(topic: string, message: any, serialize: boolean = true) {
    this.#logger.debug(`> ${topic}`);
    this.#client!.publish(topic, serialize ? JSON.stringify(message) : message);
  }
}
