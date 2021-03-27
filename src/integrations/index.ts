import mqtt from "mqtt";
import pino from "pino";

import { State, IStore } from "../store";
import { AGENT } from "../version";

type IntegrationOptions = {
  debug?: boolean;
  mqttHost?: string;
  store: IStore;
  deviceUuid: string;
};

type IntegrationConfig = {
  [name: string]: any;
};

type LastWill = {
  topic: string;
  payload: string;
};

export type MessageCallback = (
  route: RouteInfo,
  message: string | Buffer
) => Promise<void>;

export type CommandCallback = (
  route: RouteInfo,
  command: CommandPayload
) => Promise<void>;

type Route = {
  match: string;
  regex: RegExp;
  mqttTopic: string;
  callback: MessageCallback;
};

export type RouteInfo = {
  route: Route;
  topic: string;
  params: {
    [key: string]: string;
  };
};

export type CommandPayload = {
  id?: string;
  name: string;
  data: {
    [key: string]: any;
  };
};

interface IIntegration {
  getCanonicalName(): string;

  getLastWill(): LastWill | null;

  init(): Promise<void>;

  destroy(): Promise<void>;

  onMessage(topic: string, message: string | Buffer): Promise<void>;

  subscribe(topic: string): Promise<void>;

  publish(topic: string, message: any, serialize?: boolean): Promise<void>;

  log(message: any): void;

  error(message: any): void;

  setState(state: State): Promise<void>;

  getState(): Promise<State>;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
// XX(dcramer): why is this not stdlib?
const escapeRegExp = (str: string) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
};

export class Integration implements IIntegration {
  #store: IStore;
  #mqtt: mqtt.Client;
  #name: string;

  private routes: Route[] = [];

  public readonly logger: pino.Logger;
  public readonly deviceUuid: string;
  public readonly config: IntegrationConfig = {};

  constructor(
    {
      deviceUuid,
      store,
      mqttHost = "localhost",
      debug = false,
    }: IntegrationOptions,
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

  /* tslint:disable-next-line */
  async init() {}

  /* tslint:disable-next-line */
  async destroy() {}

  getCanonicalName() {
    return this.constructor.name.replace(/Integration$/, "").toLowerCase();
  }

  getLastWill(): LastWill | null {
    return null;
  }

  async route(match: string, callback: MessageCallback) {
    const regexPattern = match.replace(/\/\{([^]+)\}\//g, (_, paramName) => {
      return `\\/(?<${escapeRegExp(paramName)}>[^\/]+)\\/`;
    });
    const mqttTopic = match.replace(/\/\{([^]+)\}\//g, "+");

    this.routes.push({
      match,
      regex: new RegExp(regexPattern, "gi"),
      mqttTopic,
      callback,
    });

    this.logger.debug(`subscribed to ${mqttTopic}`);
    await this.subscribe(mqttTopic);
  }

  async routeCommand(match: string, callback: CommandCallback) {
    await this.route(
      match,
      async (routeInfo: RouteInfo, message: string | Buffer) => {
        const payload = this.parseCommand(message);
        await callback(routeInfo, payload);
      }
    );
  }

  /* tslint:disable-next-line */
  async onMessage(topic: string, message: string | Buffer) {
    for (let i = 0, route, match; i < this.routes.length; i++) {
      route = this.routes[i];
      match = topic.match(route.regex);
      if (!match) {
        continue;
      }
      try {
        const routeInfo = {
          route,
          topic,
          params: match.groups ?? {},
        };
        await route.callback(routeInfo, message);
      } catch (err) {
        this.logger.error(`Error with route handler: ${err}`);
      }
      break;
    }

    this.logger.warn(`No route for ${topic}`);
  }

  parseCommand(message: string | Buffer): CommandPayload {
    const payload = JSON.parse(message.toString()) as CommandPayload;
    return payload;
  }

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
