import pino from "pino";

import { sleep } from "../utils/promises";

import { Integration } from "./";

export default class IntegrationManger {
  private logger: pino.Logger;
  private integrations: Integration[];

  constructor({
    logger,
    integrations,
  }: {
    logger: pino.Logger;
    integrations: Integration[];
  }) {
    this.logger = logger;
    this.integrations = integrations;
  }

  async start() {
    this.integrations.forEach(async (integration) => {
      this.logger.info(`Starting integration ${integration.id}`);
      try {
        // TODO(dcramer): need to make this check if the integration is alive
        try {
          await integration.init();
        } catch (err) {
          this.logger.error(err);
        }
      } catch (err) {
        return this.logger.error(`Fatal error, will not retry: ${err}`);
      }
    });
  }
}
