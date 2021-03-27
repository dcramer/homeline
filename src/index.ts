import yargs from "yargs/yargs";
import machineUuid from "machine-uuid";
import YAML from "yaml";
import fs from "fs";
import path from "path";
import pino from "pino";

import { Broker } from "./broker";
import { Store } from "./store";
import { WebUI } from "./webui";
import { RethrownError } from "./utils/errors";

import { Integration } from "./integrations";

class IntegrationLoadError extends RethrownError {}

type Options = {
  webPort: number;
  mqttHost: string;
  debug: boolean;
  configPath: string;
  cachePath: string;
};

type ConfigIntegrationEntry = {
  id: string;
  module: string;
  config: {
    [name: string]: any;
  };
};

type Config = {
  integrations: ConfigIntegrationEntry[];
};

const getIntegration = (
  rootPath: string,
  moduleName: string
): typeof Integration => {
  let modulePath: string;
  if (moduleName.indexOf("/") === 0) {
    modulePath = moduleName;
  } else if (moduleName.indexOf("./") === 0) {
    modulePath = path.resolve(`${rootPath}/${moduleName}`);
    // XXX: this makes it so we can load our own integrations during development
  } else if (moduleName.indexOf("homeline/integrations") === 0) {
    modulePath = path.resolve(`${__dirname}/${moduleName.substr(9)}`);
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
    throw new IntegrationLoadError(`Invalid integration: ${module}`, err);
  }
};

const main = ({ webPort, mqttHost, debug, configPath, cachePath }: Options) => {
  process.on("uncaughtException", (err) => {
    /* tslint:disable-next-line */
    console.error(err);
  });

  const logger = pino({
    name: "homeline",
    prettyPrint: debug ? { colorize: true } : undefined,
  });

  const file = fs.readFileSync(configPath, "utf8");
  const globalConfig: Config = YAML.parse(file);

  const store = new Store(cachePath, { debug });
  store.init();

  machineUuid((deviceUuid: string) => {
    // TODO(dcramer): unclear if we should still keep this as a centralized broker as we had
    // to move the MQTT clients into each integration (so they can manage their own 'last will').
    // There _is_ value in treating this as a broker still, as we may need to run integrations
    // out of band.
    const brokerOptions = { debug, deviceUuid };
    const broker = new Broker(mqttHost, brokerOptions);
    broker.init();

    const rootPath = process.cwd();

    const integrationOptions = { mqttHost, store, debug, deviceUuid };
    globalConfig.integrations.forEach(async ({ id, module, config }) => {
      logger.info(`Registering integration ${id}`);
      try {
        const cls = getIntegration(rootPath, module);
        const integration = new cls(integrationOptions, config);
        await integration.init();
      } catch (err) {
        logger.error(err);
      }
    });
  });

  const webui = new WebUI(webPort, { debug });
  webui.listen();
};

const argv = yargs(process.argv).options({
  webPort: { type: "number", default: 3000 },
  mqttHost: { type: "string", default: "localhost:1883" },
  debug: { type: "boolean", default: false },
  configPath: { type: "string", default: "./config.yml" },
  cachePath: { type: "string", default: "~/.cache/homeline.json" },
}).argv;

main(argv);
