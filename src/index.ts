import yargs from "yargs/yargs";

import { Broker } from "./broker";
import { webui } from "./webui";

import EchoIntegration from "./integrations/echo";

type Options = {
  webPort: number;
  mqttHost: string;
};

const main = ({ webPort = 3000, mqttHost = "localhost" }: Options) => {
  const broker = new Broker(mqttHost);
  broker.init();

  const echo = new EchoIntegration(broker);
  echo.init();

  webui.listen(webPort, () => {
    return console.log(`[ui] listening on http://localhost:${webPort}`);
  });
};

const argv = yargs().options({
  webPort: { type: "number", default: 3000 },
  mqttHost: { type: "string", default: "localhost:1883" },
}).argv;

main(argv);
