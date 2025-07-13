import axios from 'axios';
import { pamService } from './pam';

export interface OktaConfig {
  domain: string;
  spaClientId: string;
  clientCredentialsClientId: string;
  apiToken: string;
}

export class OktaService {
  private config: OktaConfig;

  constructor() {
    this.config = {
      domain: process.env.OKTA_DOMAIN || 'fcxdemo.okta.com',
      spaClientId: process.env.OKTA_SPA_CLIENT_ID || '0oat46o2xf1bddBxb697',
      clientCredentialsClientId: process.env.OKTA_CLIENT_CREDENTIALS_CLIENT_ID || '0oat4agvajRwbJlbU697',
      apiToken: process.env.OKTA_API_TOKEN || '00R8Oroauby567d6O2oO04L7fYM44fOxj83U9p-ftm',
    };
  }

  async getClientCredentialsToken(scopes: string[] = ['okta.users.read']): Promise<string> {
    try {
      // Retrieve client secret from PAM vault - Zero Trust principle
      const clientSecret = await pamService.retrieveSecret();
      
      const response = await axios.post(
        `https://${this.config.domain}/oauth2/v1/token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          scope: scopes.join(' '),
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${this.config.clientCredentialsClientId}:${clientSecret}`).toString('base64')}`,
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
            'Authorization': `Basic ${Buffer.from(`${this.config.clientCredentialsClientId}:${process.env.OKTA_CLIENT_CREDENTIALS_CLIENT_SECRET || 'demo-secret'}`).toString('base64')}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error introspecting token:', error);
      throw new Error('Failed to introspect token');
    }
  }

  async sendVerifyPush(userId: string, message: string, factorId: string = 'opft473jgukmcdFGI697'): Promise<any> {
    try {
      // Ensure domain has https:// prefix
      const domain = this.config.domain.startsWith('http') ? this.config.domain : `https://${this.config.domain}`;
      const url = `${domain}/api/v1/users/${userId}/factors/${factorId}/verify`;
      
      console.log('Push notification URL constructed:', url);
      console.log('UserId parameter:', userId);
      console.log('FactorId parameter:', factorId);
      console.log('Domain config:', this.config.domain);
      
      // For push factors, send empty body to initiate challenge
      const response = await axios.post(
        url,
        {}, // Empty body for push challenge
        {
          headers: {
            'Authorization': `SSWS ${this.config.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Push notification response:', response.status, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error sending Okta Verify push:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw new Error('Failed to send Okta Verify push notification');
    }
  }

  async pollPushTransaction(pollUrl: string): Promise<any> {
    try {
      const response = await axios.get(pollUrl, {
        headers: {
          'Authorization': `SSWS ${this.config.apiToken}`,
          'Accept': 'application/json',
        },
      });

      console.log('Push poll response:', response.status, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error polling Okta push transaction:', error);
      if (error.response) {
        console.error('Poll response status:', error.response.status);
        console.error('Poll response data:', error.response.data);
      }
      throw new Error('Failed to poll Okta push transaction');
    }
  }

  getOIDCConfig(req?: any) {
    // Support custom domain for production deployment
    let baseUrl = 'http://localhost:5000';
    
    // Check request headers first for custom domain detection
    const host = req?.get ? req.get('host') : null;
    
    if (host?.includes('agent.kriyahub.com')) {
      baseUrl = 'https://agent.kriyahub.com';
    } else if (process.env.CUSTOM_DOMAIN === 'agent.kriyahub.com') {
      baseUrl = 'https://agent.kriyahub.com';
    } else if (process.env.REPLIT_DOMAINS) {
      baseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
    }
    
    return {
      issuer: 'https://fcxdemo.okta.com/oauth2/default',
      authorizationEndpoint: 'https://fcxdemo.okta.com/oauth2/default/v1/authorize',
      tokenEndpoint: 'https://fcxdemo.okta.com/oauth2/default/v1/token',
      jwksUri: 'https://fcxdemo.okta.com/oauth2/default/v1/keys',
      domain: this.config.domain,
      clientId: this.config.spaClientId,
      redirectUri: baseUrl,
      scopes: ['openid', 'profile', 'email'],
    };
  }
}

export const oktaService = new OktaService();
