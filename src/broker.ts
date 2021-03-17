import mqtt from "mqtt";

type ShutdownOptions = {
  cleanup?: boolean;
  exit?: boolean;
};

type ClientOptions = {
  host: string;
  singleton?: boolean;
};

let client: mqtt.Client;

const log = (message: string) => {
  console.log(`[mqtt] ${message}`);
};

export const initBroker = ({
  host,
  singleton = true,
}: ClientOptions): mqtt.Client => {
  if (singleton && client) return client;

  const localClient = mqtt.connect(`mqtt://${host}`);
  log(`connecting to broker on mqtt://${host}`);

  localClient.on("error", (err: any) => {
    log(`error: ${err}`);
  });

  localClient.on("connect", () => {
    log("connected");
    // localClient.subscribe("#");
    // client.publish('garage/connected', 'true')
  });

  localClient.on("message", (topic: string, message: any) => {
    // switch (topic) {
    //   case 'garage/connected':
    //     return handleGarageConnected(message)
    //   case 'garage/state':
    //     return handleGarageState(message)
    // }
    log(`${topic} | ${message}`);
  });

  const onShutdown = (
    { cleanup, exit }: ShutdownOptions,
    err: Error | undefined = undefined
  ) => {
    if (err && err.stack) {
      log(err.stack?.toString());
    }

    if (cleanup) {
      // client.publish("garage/connected", "false");
    }

    if (exit) {
      process.exit();
    }
  };

  /**
   * Handle the different ways an application can shutdown
   */
  process.on("exit", () => onShutdown({ cleanup: true }));
  process.on("uncaughtException", () => onShutdown({ exit: true }));
  process.on("SIGINT", () => onShutdown({ exit: true }));

  client = localClient;

  return localClient;
};
