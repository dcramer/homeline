import yargs from "yargs/yargs";
import machineUuid from "machine-uuid";
import YAML from "yaml";
import fs from "fs";
import pino from "pino";

import { Broker } from "./broker";
import { WebUI } from "./webui";

import { Integration } from "./integrations";
import EchoIntegration from "./integrations/echo";
import SimpliSafeIntegration from "./integrations/simplisafe";

type Options = {
  webPort: number;
  mqttHost: string;
  debug: boolean;
  configFile: string;
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

const main = ({ webPort, mqttHost, debug, configFile }: Options) => {
  const logger = pino({
    name: "homeline",
    prettyPrint: debug ? { colorize: true } : undefined,
  });

  const file = fs.readFileSync(configFile, "utf8");
  const globalConfig: Config = YAML.parse(file);

  const broker = new Broker(mqttHost, { debug });
  broker.init();

  const webui = new WebUI(webPort, { debug });
  webui.listen();

  machineUuid((deviceUuid: string) => {
    const options = { debug, deviceUuid };

    globalConfig.integrations.forEach(async ({ type, config }) => {
      logger.info(`Registering integration ${type}`);
      const cls = getIntegration(type);
      const integration = new cls(broker, options, config);
      try {
        await integration.init();
      } catch (err) {
        logger.error(err);
      }
    });
  });
};

const argv = yargs(process.argv).options({
  webPort: { type: "number", default: 3000 },
  mqttHost: { type: "string", default: "localhost:1883" },
  debug: { type: "boolean", default: false },
  configFile: { type: "string", default: "./config.yml" },
}).argv;

main(argv);
