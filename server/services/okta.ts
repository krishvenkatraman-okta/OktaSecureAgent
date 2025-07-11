import axios from 'axios';

export interface OktaConfig {
  domain: string;
  spaClientId: string;
  clientCredentialsClientId: string;
  clientCredentialsClientSecret: string;
  apiToken: string;
}

export class OktaService {
  private config: OktaConfig;

  constructor() {
    this.config = {
      domain: process.env.OKTA_DOMAIN || 'fcxdemo.okta.com',
      spaClientId: process.env.OKTA_SPA_CLIENT_ID || '0oat46o2xf1bddBxb697',
      clientCredentialsClientId: process.env.OKTA_CLIENT_CREDENTIALS_CLIENT_ID || '0oat4agvajRwbJlbU697',
      clientCredentialsClientSecret: process.env.OKTA_CLIENT_CREDENTIALS_CLIENT_SECRET || 'w-duI3IyYtEqlNKsmlR2LaRICXVUUr61sMzYHbeQ2q5_3qeoTTtSETIvzjPPLA9O',
      apiToken: process.env.OKTA_API_TOKEN || '00R8Oroauby567d6O2oO04L7fYM44fOxj83U9p-ftm',
    };
  }

  async getClientCredentialsToken(scopes: string[] = ['okta.users.read']): Promise<string> {
    try {
      const response = await axios.post(
        `https://${this.config.domain}/oauth2/v1/token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          scope: scopes.join(' '),
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${this.config.clientCredentialsClientId}:${this.config.clientCredentialsClientSecret}`).toString('base64')}`,
          },
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('Error getting client credentials token:', error);
      throw new Error('Failed to obtain client credentials token');
    }
  }

  async getUserProfile(userId: string): Promise<any> {
    try {
      const token = await this.getClientCredentialsToken(['okta.users.read']);
      
      const response = await axios.get(
        `https://${this.config.domain}/api/v1/users/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  async introspectToken(token: string): Promise<any> {
    try {
      const response = await axios.post(
        `https://${this.config.domain}/oauth2/v1/introspect`,
        new URLSearchParams({
          token,
          token_type_hint: 'access_token',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${this.config.clientCredentialsClientId}:${this.config.clientCredentialsClientSecret}`).toString('base64')}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error introspecting token:', error);
      throw new Error('Failed to introspect token');
    }
  }

  async sendVerifyPush(userId: string, message: string): Promise<any> {
    try {
      const response = await axios.post(
        `https://${this.config.domain}/api/v1/users/${userId}/factors/push/verify`,
        {
          message,
        },
        {
          headers: {
            'Authorization': `SSWS ${this.config.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error sending Okta Verify push:', error);
      throw new Error('Failed to send Okta Verify push notification');
    }
  }

  getOIDCConfig() {
    return {
      domain: this.config.domain,
      clientId: this.config.spaClientId,
      redirectUri: `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/callback`,
      scopes: ['openid', 'profile', 'email'],
    };
  }
}

export const oktaService = new OktaService();
