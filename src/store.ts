import fs from "fs";
import path from "path";
import pino from "pino";

export type State = {
  [name: string]: any;
};

type StoreOptions = {
  debug?: boolean;
};

const resolvePath = (filePath: string): string => {
  const os = require("os");
  if (!filePath || typeof filePath !== "string") {
    return "";
  }

  // '~/folder/path' or '~' not '~alias/folder/path'
  if (filePath.startsWith("~/") || filePath === "~") {
    return filePath.replace("~", os.homedir());
  }

  return filePath;
};

export interface IStore {
  init(): void;
  setState(namespace: string, state: State): Promise<void>;
  getState(namespace: string): Promise<State>;
}

export class Store implements IStore {
  #filepath: string;
  #state: State = {};
  #logger: pino.Logger;
  #debug: boolean;

  constructor(
    filepath: string = "~/.cache/homeline.json",
    { debug = false }: StoreOptions = {}
  ) {
    this.#filepath = resolvePath(filepath);
    this.#state = {};
    this.#debug = debug;

    this.#logger = pino({
      name: "store",
      level: debug ? "debug" : "info",
      prettyPrint: debug ? { colorize: true } : undefined,
    });
  }

  init() {
    const dir = path.dirname(this.#filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    } else {
      try {
        fs.accessSync(dir, fs.constants.W_OK);
      } catch (err) {
        throw new Error(`No write access to ${this.#filepath}`);
      }
    }

    this.loadState();
  }

  private loadState() {
    if (fs.existsSync(this.#filepath)) {
      this.#logger.info(`Loading cached state from ${this.#filepath}`);
      this.#state = JSON.parse(fs.readFileSync(this.#filepath, "utf8"));
    }
  }

  private saveState() {
    this.#logger.debug(`Writing state to ${this.#filepath}`);
    fs.writeFileSync(this.#filepath, JSON.stringify(this.#state));
  }

  async setState(namespace: string, state: State) {
    if (!this.#state[namespace]) this.#state[namespace] = {};
    Object.keys(state).forEach((key) => {
      this.#state[namespace][key] = state[key];
    });
    this.saveState();
  }

  async getState(namespace: string) {
    return this.#state[namespace] || {};
  }
}
