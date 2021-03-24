import axios, { AxiosResponse } from "axios";

const API_URL_BASE = "https://api.simplisafe.com/v1/api";

type AuthenticationResult = {
  status: string;
  accessToken?: string;
  refreshToken?: string;
};

export default class SimpliSafeApi {
  #apiUrl: string = API_URL_BASE;

  #clientId: string;

  constructor({ clientId }: { clientId: string }) {
    this.#clientId = clientId;
  }

  async authenticate(payload = {}) {
    let response: AxiosResponse;

    try {
      response = await axios.post(`${this.#apiUrl}/token`, {
        client_id: this.#clientId,
        scope: "offline_access",
        ...payload,
      });
    } catch (err) {
      if (!err.response) {
        throw err;
      }
      const data = err.response.data;
      if (data.mfa_token) {
        return await this.handleMFAChallenge(err.response);
      }
      throw err;
    }

    return {
      status: "authenticated",
      accessToken: response!.data.access_token,
      refreshToken: response!.data.refresh_token,
    } as AuthenticationResult;
  }

  async verifyAuth(accessToken: string) {
    const authResponse = await axios.get(`${this.#apiUrl}/authCheck`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userId = authResponse!.data.userId;
    return {
      userId,
    };
  }

  async handleMFAChallenge(tokenResponse: AxiosResponse) {
    const response = await axios.post(`${this.#apiUrl}/mfa/challenge`, {
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
    } as AuthenticationResult;
  }

  async refreshToken(refreshToken: string) {
    return await this.authenticate({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }
}
