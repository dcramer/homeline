import axios, { AxiosResponse, Method } from "axios";
import EventEmitter from "events";

import { RethrownError } from "../../utils/errors";

const API_URL_BASE = "https://api.simplisafe.com/v1";

export enum AlarmState {
  away,
  home,
  off,
}

export type SimpliSafeSystem = {
  uid: number;
  sid: number;
  // many other attributes that dont seem to be relevant for typical usage
};

export class SimpliSafeApiError extends RethrownError {}

export class SimpliSafeAuthError extends SimpliSafeApiError {}

export type SimpliSafeToken = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type AuthenticationResult = {
  status: string;
  token?: SimpliSafeToken;
};

export default class SimpliSafeApi extends EventEmitter {
  #apiUrl: string = API_URL_BASE;

  #clientId: string;
  #token?: SimpliSafeToken;

  constructor({
    clientId,
    token,
  }: {
    clientId: string;
    token?: SimpliSafeToken;
  }) {
    super();

    this.#clientId = clientId;
    this.#token = token;
  }

  setAccessToken(token?: SimpliSafeToken) {
    this.#token = token;

    this.emit("token", token);
  }

  async setAlarmState(systemId: string, state: AlarmState) {
    await this.request(
      "post",
      `/ss3/subscriptions/${systemId}/state/${AlarmState[state].toString()}`
    );
  }

  async getSystems(userId: string): Promise<SimpliSafeSystem[]> {
    const response = await this.request(
      "get",
      `/users/${userId}/subscriptions`,
      {
        params: { activeOnly: "true" },
      }
    );

    return response.data.subscriptions.map((entry: SimpliSafeSystem) => ({
      sid: entry.sid,
      uid: entry.uid,
    }));
  }

  async request(method: Method, path: string, ...args: any): Promise<any> {
    if (!this.#token) {
      throw new Error("No access token set");
    }
    try {
      return await axios.request({
        method,
        url: `${this.#apiUrl}${path}`,
        headers: {
          Authorization: `Bearer ${this.#token.accessToken}`,
        },
        ...args,
      });
    } catch (err) {
      if (err.response && err.response.data) {
        if (err.response.status === 401) {
          throw new SimpliSafeAuthError(
            `HTTP ${err.response.status}: ${err.response.data.message}`,
            err
          );
        }
        throw new SimpliSafeApiError(
          `HTTP ${err.response.status}: ${err.response.data.message}`,
          err
        );
      }
      throw err;
    }
  }

  async authenticate(payload = {}): Promise<AuthenticationResult> {
    let response: AxiosResponse;

    try {
      response = await axios.post(`${this.#apiUrl}/api/token`, {
        client_id: this.#clientId,
        scope: "offline_access",
        ...payload,
      });
    } catch (err) {
      if (!err.response) {
        throw err;
      }
      const data = err.response.data;
      if (data && data.mfa_token) {
        return await this.handleMFAChallenge(err.response);
      }
      throw err;
    }

    const accessToken = response!.data.access_token;
    const refreshToken = response!.data.refresh_token;
    const expiresAt = new Date().getTime() + response!.data.expires_in;

    const token: SimpliSafeToken = { accessToken, refreshToken, expiresAt };

    this.setAccessToken(token);

    return {
      status: "authenticated",
      token,
    };
  }

  async verifyAuth(): Promise<{ userId: string }> {
    let authResponse;
    try {
      authResponse = await this.request("get", `/api/authCheck`);
    } catch (err) {
      if (err.response?.status === 404) {
        throw new SimpliSafeAuthError("404 while verifying auth", err);
      }
      throw err;
    }
    const userId = authResponse!.data.userId;

    return {
      userId,
    };
  }

  async handleMFAChallenge(
    tokenResponse: AxiosResponse
  ): Promise<AuthenticationResult> {
    const response = await axios.post(`${this.#apiUrl}/api/mfa/challenge`, {
      challenge_type: "oob",
      client_id: this.#clientId,
      mfa_token: tokenResponse.data.mfa_token,
    });

    try {
      await axios.post(`${this.#apiUrl}/token`, {
        client_id: this.#clientId,
        grant_type: "http://simplisafe.com/oauth/grant-type/mfa-oob",
        mfa_token: tokenResponse.data.mfa_token,
        oob_code: response.data.oob_code,
        scope: "offline_access",
      });
    } catch (err) {
      throw err;
    }

    return {
      status: "pending_mfa",
    };
  }

  async refreshToken(refreshToken: string) {
    return await this.authenticate({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }
}
