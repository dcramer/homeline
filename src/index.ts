import yargs from "yargs/yargs";
import machineUuid from "machine-uuid";
import YAML from "yaml";
import fs from "fs";
import pino from "pino";

import { Broker } from "./broker";
import { Store } from "./store";
import { WebUI } from "./webui";

import { Integration } from "./integrations";
import EchoIntegration from "./integrations/echo";
import SimpliSafeIntegration from "./integrations/simplisafe";

type Options = {
  webPort: number;
  mqttHost: string;
  debug: boolean;
  configPath: string;
  cachePath: string;
};

type ConfigIntegrationEntry = {
  type: string;
  config: {
    [name: string]: any;
  };
};

type Config = {
  integrations: ConfigIntegrationEntry[];
};

const getIntegration = (name: string): typeof Integration => {
  switch (name) {
    case "simplisafe":
      return SimpliSafeIntegration;
    case "echo":
      return EchoIntegration;
    default:
      throw new Error(`Invalid integration: ${name}`);
  }
};

const main = ({ webPort, mqttHost, debug, configPath, cachePath }: Options) => {
  const logger = pino({
    name: "homeline",
    prettyPrint: debug ? { colorize: true } : undefined,
  });

  const file = fs.readFileSync(configPath, "utf8");
  const globalConfig: Config = YAML.parse(file);

  const store = new Store(cachePath, { debug });
  store.init();

  const broker = new Broker(mqttHost, { debug });
  broker.init();

  machineUuid((deviceUuid: string) => {
    const options = { debug, deviceUuid };

    globalConfig.integrations.forEach(async ({ type, config }) => {
      logger.info(`Registering integration ${type}`);
      const cls = getIntegration(type);
      const integration = new cls(broker, store, options, config);
      try {
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
