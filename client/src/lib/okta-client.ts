import { OktaAuth } from '@okta/okta-auth-js';

export interface OktaConfig {
  domain: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export class OktaClient {
  private oktaAuth: OktaAuth;
  private config: OktaConfig;

  constructor(config: OktaConfig) {
    this.config = config;
    this.oktaAuth = new OktaAuth({
      issuer: `https://${config.domain}/oauth2/default`,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scopes: config.scopes,
      pkce: true,
      responseType: 'code',
    });
  }

  async login(): Promise<void> {
    await this.oktaAuth.signInWithRedirect();
  }

  async handleCallback(): Promise<{ idToken: string; accessToken: string; userId: string }> {
    const tokens = await this.oktaAuth.handleRedirectCallback();
    
    if (!tokens.tokens.idToken || !tokens.tokens.accessToken) {
      throw new Error('No tokens received from Okta');
    }

    const idToken = tokens.tokens.idToken.value;
    const accessToken = tokens.tokens.accessToken.value;
    const userId = tokens.tokens.idToken.claims.sub;

    return { idToken, accessToken, userId };
  }

  async isAuthenticated(): Promise<boolean> {
    return await this.oktaAuth.isAuthenticated();
  }

  async getUser(): Promise<any> {
    return await this.oktaAuth.getUser();
  }

  async logout(): Promise<void> {
    await this.oktaAuth.signOut();
  }

  async getAccessToken(): Promise<string> {
    const accessToken = await this.oktaAuth.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }
    return accessToken;
  }

  async getIdToken(): Promise<string> {
    const idToken = await this.oktaAuth.getIdToken();
    if (!idToken) {
      throw new Error('No ID token available');
    }
    return idToken;
  }
}
