import yargs from "yargs/yargs";

import { Broker } from "./broker";
import { WebUI } from "./webui";

import EchoIntegration from "./integrations/echo";

type Options = {
  webPort: number;
  mqttHost: string;
  debug: boolean;
};

const main = ({
  webPort = 3000,
  mqttHost = "localhost",
  debug = true,
}: Options) => {
  const broker = new Broker(mqttHost, { debug });
  broker.init();

  const echo = new EchoIntegration(broker, { debug });
  echo.init();

  const webui = new WebUI(webPort, { debug });
  webui.listen();
};

const argv = yargs(process.argv).options({
  webPort: { type: "number", default: 3000 },
  mqttHost: { type: "string", default: "localhost:1883" },
  debug: { type: "boolean", default: false },
}).argv;

main(argv);
