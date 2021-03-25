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

    const integrationOptions = { mqttHost, store, debug, deviceUuid };
    globalConfig.integrations.forEach(async ({ type, config }) => {
      logger.info(`Registering integration ${type}`);
      const cls = getIntegration(type);
      const integration = new cls(integrationOptions, config);
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
