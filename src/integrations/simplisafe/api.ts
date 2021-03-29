import axios, { AxiosResponse, Method } from "axios";

import { RethrownError } from "../../utils/errors";

const API_URL_BASE = "https://api.simplisafe.com/v1";

type AuthenticationResult = {
  status: string;
  accessToken?: string;
  refreshToken?: string;
};

export enum AlarmState {
  away,
  home,
  off,
}

type SimpliSafeSystem = {
  uid: number;
  sid: number;
  // many other attributes that dont seem to be relevant for typical usage
};

class SimpliSafeApiError extends RethrownError {}

export default class SimpliSafeApi {
  #apiUrl: string = API_URL_BASE;

  #clientId: string;

  constructor({ clientId }: { clientId: string }) {
    this.#clientId = clientId;
  }

  async setAlarmState(
    accessToken: string,
    systemId: string,
    state: AlarmState
  ) {
    await this.request(
      "post",
      `/ss3/subscriptions/${systemId}/state/${AlarmState[state].toString()}`,
      accessToken
    );
  }

  async getSystems(
    accessToken: string,
    userId: string
  ): Promise<SimpliSafeSystem[]> {
    const response = await this.request(
      "get",
      `/users/${userId}/subscriptions`,
      accessToken,
      {
        params: { activeOnly: "true" },
      }
    );

    return response.data.subscriptions.map((entry: SimpliSafeSystem) => ({
      sid: entry.sid,
      uid: entry.uid,
    }));
  }

  async request(
    method: Method,
    path: string,
    accessToken: string,
    ...args: any
  ): Promise<any> {
    try {
      return await axios.request({
        method,
        url: `${this.#apiUrl}${path}`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        ...args,
      });
    } catch (err) {
      if (err.response && err.response.data) {
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

    return {
      status: "authenticated",
      accessToken: response!.data.access_token,
      refreshToken: response!.data.refresh_token,
    };
  }

  async verifyAuth(accessToken: string): Promise<{ userId: string }> {
    const authResponse = await axios.get(`${this.#apiUrl}/api/authCheck`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

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
