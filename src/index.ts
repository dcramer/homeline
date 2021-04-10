import yargs from "yargs/yargs";
import machineUuid from "machine-uuid";
import YAML from "yaml";
import fs from "fs";
import pino from "pino";

import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";

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
  sentry?: {
    dsn?: string;
    tracesSampleRate: number;
  };
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
  // XXX(dcramer): Sentry's types appear wrong... Tracing.Transaction is not compat here?
  let transaction: any | null;

  process.on("uncaughtException", (err) => {
    /* tslint:disable-next-line */
    console.error(err);
    if (transaction) {
      transaction.setStatus("error");
    }
  });

  const file = fs.readFileSync(configPath, "utf8");
  const globalConfig: Config = YAML.parse(file);

  Sentry.init({
    debug,
    ...(globalConfig.sentry || {}),
  });

  transaction = Sentry.startTransaction({
    op: "boot",
    name: "boot",
  });

  const logger = pino({
    name: "homeline",
    prettyPrint: debug ? { colorize: true } : undefined,
  });

  let span = transaction.startChild({
    op: "boot.init-store",
    description: cachePath,
  });
  const store = new Store(cachePath, { debug });
  store.init();
  span.finish();

  span = transaction.startChild({
    op: "boot.get-device-id",
    description: "",
  });
  const deviceId = await getDeviceId();
  span.finish();

  span = transaction.startChild({
    op: "boot.load-integrations",
    description: "",
  });

  const loader = new IntegrationLoader({ logger });
  const integrations = await loader.loadAll(globalConfig.integrations, {
    mqttHost,
    store,
    debug,
    deviceId,
  });
  span.finish();

  // TODO(dcramer): unclear if we should still keep this as a centralized broker as we had
  // to move the MQTT clients into each integration (so they can manage their own 'last will').
  // There _is_ value in treating this as a broker still, as we may need to run integrations
  // out of band.
  span = transaction.startChild({
    op: "boot.init-broker",
    description: mqttHost,
  });

  const brokerOptions = { debug, deviceId };
  const broker = new Broker(mqttHost, brokerOptions);
  broker.init();
  span.finish();

  span = transaction.startChild({
    op: "boot.init-integrations",
    description: "",
  });
  const integrationManager = new IntegrationManager({ logger, integrations });
  integrationManager.start();
  span.finish();

  span = transaction.startChild({
    op: "boot.init-webui",
    description: "",
  });
  const webui = new WebUI(webPort, { debug });
  webui.listen();
  span.finish();

  transaction.setStatus("ok");
  transaction.finish();
  transaction = null;
};

const argv = yargs(process.argv).options({
  webPort: { type: "number", default: 3000 },
  mqttHost: { type: "string", default: "localhost:1883" },
  debug: { type: "boolean", default: false },
  configPath: { type: "string", default: "./config.yml" },
  cachePath: { type: "string", default: "~/.cache/homeline/state.json" },
}).argv;

main(argv);
