import axios, { AxiosResponse } from "axios";

import { Integration } from "../";
import { AGENT } from "../../version";

import SimpliSafeStream from "./stream";

const APP_VERSION = "1.62.0";
const API_URL_BASE = "https://api.simplisafe.com/v1/api";

type SimpliSafeConfig = {
  username?: string;
  password?: string;
};

enum State {
  authenticating,
  pending_mfa,
  ready,
}

export default class SimpliSafeIntegration extends Integration {
  // public readonly config: SimpliSafeConfig = {};

  #state?: State;
  #apiUrl: string = API_URL_BASE;
  #stream: SimpliSafeStream = new SimpliSafeStream();

  #ssClientId?: string;
  #ssDeviceId?: string;

  async init() {
    // this.subscribe("simplisafe/", this.onEcho);
    // setInterval(() => {
    //   this.publish("test/echo", `Echo - ${new Date().getTime()}`);
    // }, 1000);
    this.#ssClientId = `${AGENT}.WebApp.simplisafe.com`;
    this.#ssDeviceId = `WebApp; useragent="Safari 13.1 (SS-ID: {0}) / macOS 10.15.6"; uuid="${this.deviceUuid}"; id="${AGENT}"`;

    try {
      await this.verifyAuth();
    } catch (err) {
      try {
        await this.authenticate({
          grant_type: "password",
          username: this.config.username,
          password: this.config.password,
          app_version: APP_VERSION,
          device_id: this.#ssDeviceId,
        });
      } catch (err) {
        this.logger.error(`Authentication failed: ${err}`);
      }
    }
  }

  async authenticate(payload = {}) {
    if (!this.config.username) {
      throw new Error("Missing username configuration");
    }
    if (!this.config.password) {
      throw new Error("Missing password configuration");
    }
    this.#state = State.authenticating;

    let response: AxiosResponse;

    try {
      response = await axios.post(`${this.#apiUrl}/token`, {
        client_id: this.#ssClientId,
        scope: "offline_access",
        ...payload,
      });
    } catch (err) {
      if (!err.response) {
        return this.logger.error(err);
      }
      const data = err.response.data;
      if (data.mfa_token) {
        this.logger.info("Received MFA challenge");
        return await this.handleMFAChallenge(err.response);
      }
      this.logger.error(`Authentication failed: ${data.error_description}`);
      return;
    }

    await this.setState({
      accessToken: response!.data.access_token,
      refreshToken: response!.data.refresh_token,
    });
  }

  async verifyAuth() {
    const { accessToken } = await this.getState();
    if (!accessToken) {
      throw new Error("No access token");
    }

    const authResponse = await axios.get(`${this.#apiUrl}/authCheck`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userId = authResponse!.data.userId;

    await this.setState({
      userId,
    });

    this.logger.info(`Authenticated with SimpliSafe`);

    this.#stream.init(accessToken, userId, this.logger);
  }

  async handleMFAChallenge(tokenResponse: AxiosResponse) {
    this.#state = State.pending_mfa;

    const response = await axios.post(`${this.#apiUrl}/mfa/challenge`, {
      challenge_type: "oob",
      client_id: this.#ssClientId,
      mfa_token: tokenResponse.data.mfa_token,
    });

    try {
      await axios.post(`${this.#apiUrl}/token`, {
        client_id: this.#ssClientId,
        grant_type: "http://simplisafe.com/oauth/grant-type/mfa-oob",
        mfa_token: tokenResponse.data.mfa_token,
        oob_code: response.data.oob_code,
        scope: "offline_access",
      });
    } catch (err) {
      this.logger.error(`Error fetching token post-MFA: ${err}`);
      throw err;
    }

    this.logger.info(
      "Check your email for an MFA link to complete authentication with SimpliSafe."
    );
  }

  async refreshToken() {
    const { refreshToken } = await this.getState();
    await this.authenticate({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }
}
