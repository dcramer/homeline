import yargs from "yargs/yargs";

import { Broker } from "./broker";
import { webui } from "./webui";

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

  webui.listen(webPort, () => {
    return console.log(`[ui] listening on http://localhost:${webPort}`);
  });
};

const argv = yargs(process.argv).options({
  webPort: { type: "number", default: 3000 },
  mqttHost: { type: "string", default: "localhost:1883" },
  debug: { type: "boolean", default: false },
}).argv;

main(argv);
