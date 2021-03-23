import mqtt from "mqtt";

type ShutdownOptions = {
  cleanup?: boolean;
  exit?: boolean;
};

export type MessageCallback = (message: any, topic: string) => void;

export type Subscription = [string, MessageCallback];

const log = (message: string) => {
  console.log(`[mqtt] ${message}`);
};

export class Broker {
  private host: string;
  private client?: mqtt.Client;
  private subscribers: Subscription[];

  constructor(host: string = "localhost:1833") {
    this.host = host;
    this.subscribers = [];
  }

  public init() {
    if (this.client) return;

    log(`connecting to broker on mqtt://${this.host}`);

    this.client = mqtt.connect(`mqtt://${this.host}`, {
      clientId: "homeline-0.1.0",
    });

    this.client.on("error", (err: any) => {
      console.error(`[mqtt] ${err}`);
    });

    this.client.on("close", (err: any) => {
      log(`disconnected: closed`);
    });

    this.client.on("disconnect", (err: any) => {
      log(`disconnected: packet`);
    });

    this.client.on("reconnect", (err: any) => {
      log(`reconnecting`);
    });

    this.client.on("connect", () => {
      log("connected");
      const topics = new Set(this.subscribers.map(([t]) => t));
      topics.forEach((t) => this.client!.subscribe(t));
      this.client!.publish("homeline/connected", "true");
    });

    this.client.on("message", (topic: string, message: any) => {
      log(`< ${topic}`);
      this.subscribers.forEach(([t, cb]) => {
        if (topic === t) cb(message, topic);
      });
    });

    const onShutdown = (
      { cleanup, exit }: ShutdownOptions,
      err: Error | undefined = undefined
    ) => {
      if (err && err.stack) {
        log(err.stack?.toString());
      }

      if (cleanup) {
        this.client?.publish("homeline/connected", "false");
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
    this.subscribers.push([topic, callback]);
  }

  public unsubscribe(topic: string, callback: MessageCallback) {
    this.subscribers = this.subscribers.filter(([t, cb]) => {
      return t !== topic || cb !== callback;
    });
  }

  public publish(topic: string, message: string | Buffer) {
    log(`> ${topic}`);
    this.client!.publish(topic, message);
  }
}
