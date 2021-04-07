import yargs from "yargs/yargs";
import machineUuid from "machine-uuid";
import YAML from "yaml";
import fs from "fs";
import pino from "pino";

import { Broker } from "./broker";
import { Store } from "./store";
import { WebUI } from "./webui";

import IntegrationLoader from "./integrations/loader";
import IntegrationManager from "./integrations/manager";

type Options = {
  webPort: number;
  mqttHost: string;
  debug: boolean;
  configPath: string;
  cachePath: string;
};

type IntegrationConfig = {
  id: string;
  module: string;
  config: {
    [name: string]: any;
  };
};

type Config = {
  integrations: IntegrationConfig[];
};

const getDeviceId = (): Promise<string> => {
  return new Promise(machineUuid);
};

const main = async ({
  webPort,
  mqttHost,
  debug,
  configPath,
  cachePath,
}: Options) => {
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

  const deviceId = await getDeviceId();

  const loader = new IntegrationLoader({ logger });
  const integrations = await loader.loadAll(globalConfig.integrations, {
    mqttHost,
    store,
    debug,
    deviceId,
  });

  // TODO(dcramer): unclear if we should still keep this as a centralized broker as we had
  // to move the MQTT clients into each integration (so they can manage their own 'last will').
  // There _is_ value in treating this as a broker still, as we may need to run integrations
  // out of band.
  const brokerOptions = { debug, deviceId };
  const broker = new Broker(mqttHost, brokerOptions);
  broker.init();

  const integrationManager = new IntegrationManager({ logger, integrations });
  integrationManager.start();

  const webui = new WebUI(webPort, { debug });
  webui.listen();
};

const argv = yargs(process.argv).options({
  webPort: { type: "number", default: 3000 },
  mqttHost: { type: "string", default: "localhost:1883" },
  debug: { type: "boolean", default: false },
  configPath: { type: "string", default: "./config.yml" },
  cachePath: { type: "string", default: "~/.cache/homeline/state.json" },
}).argv;

main(argv);
