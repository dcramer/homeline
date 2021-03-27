import axios, { AxiosResponse } from "axios";

const API_URL_BASE = "https://api.simplisafe.com/v1";

type AuthenticationResult = {
  status: string;
  accessToken?: string;
  refreshToken?: string;
};

export enum AlarmState {
  alarm,
  alarm_count,
  away,
  away_count,
  entry_delay,
  error,
  exit_delay,
  home,
  home_count,
  off,
  test,
  unknown,
}

type SimpliSafeSystem = {
  uid: number;
  sid: number;
  // many other attributes that dont seem to be relevant for typical usage
};

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
    const response = await axios.post(
      `${this.#apiUrl}/ss3/subscriptions/${systemId}/state/${AlarmState[
        state
      ].toString()}`,
      undefined,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
  }

  async getSystems(
    accessToken: string,
    userId: string
  ): Promise<SimpliSafeSystem[]> {
    const response = await axios.get(
      `${this.#apiUrl}/users/${userId}/subscriptions`,
      {
        params: { activeOnly: "true" },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.data.subscriptions.map((entry: SimpliSafeSystem) => ({
      sid: entry.sid,
      uid: entry.uid,
    }));
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
