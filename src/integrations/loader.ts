import path from "path";
import pino from "pino";

import { RethrownError } from "../utils/errors";

import { Integration, IntegrationOptions } from "./";

class IntegrationLoadError extends RethrownError {}

type IntegrationConfig = {
  id: string;
  module: string;
  config: {
    [name: string]: any;
  };
};

export default class IntegrationManger {
  private logger: pino.Logger;

  constructor({ logger }: { logger: pino.Logger }) {
    this.logger = logger;
  }

  getIntegration(moduleName: string): typeof Integration {
    const rootPath = process.cwd();

    let modulePath: string;
    if (moduleName.indexOf("/") === 0) {
      modulePath = moduleName;
    } else if (moduleName.indexOf("./") === 0) {
      modulePath = path.resolve(`${rootPath}/${moduleName}`);
      // XXX: this makes it so we can load our own integrations during development
    } else if (moduleName.indexOf("homeline/integrations") === 0) {
      modulePath = path.resolve(`${__dirname}/${moduleName.substr(22)}`);
    } else {
      modulePath = moduleName;
    }
    try {
      const module = require(modulePath);
      if (!module) {
        throw new Error("Module not found");
      }
      const cls = module.default;
      if (typeof cls !== "function") {
        throw new Error("Integration did not export a function");
      }
      return cls;
    } catch (err) {
      throw new IntegrationLoadError(
        `Invalid integration: ${moduleName} (${modulePath})`,
        err
      );
    }
  }

  async loadAll(
    configs: IntegrationConfig[],
    options: any
  ): Promise<Integration[]> {
    return configs
      .map(({ id, module, config }) => {
        this.logger.info(`Registering integration ${id}`);
        try {
          const cls = this.getIntegration(module);
          return new cls(
            {
              ...options,
              id,
            },
            config
          );
        } catch (err) {
          this.logger.error(err);
        }
      })
      .filter((n) => !!n) as Integration[];
  }
}
