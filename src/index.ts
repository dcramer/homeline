import yargs from "yargs/yargs";

import { initBroker } from "./broker";
import { webui } from "./webui";

type Options = {
  webPort: number;
  mqttHost: string;
};

const main = ({ webPort = 3000, mqttHost = "localhost:1883" }: Options) => {
  initBroker({ host: mqttHost });

  webui.listen(webPort, () => {
    return console.log(`ui: listening on http://localhost:${webPort}`);
  });
};

const argv = yargs().options({
  webPort: { type: "number", default: 3000 },
  mqttHost: { type: "string", default: "localhost:1883" },
}).argv;

main(argv);
