import axios from 'axios';

export interface PAMConfig {
  domain: string;
  apiKeyId: string;
  apiKeySecret: string;
  resourceGroupId: string;
  projectId: string;
  secretId: string;
}

export class PAMService {
  private config: PAMConfig;

  constructor() {
    this.config = {
      domain: process.env.OKTA_DOMAIN || 'fcxdemo.okta.com',
      apiKeyId: process.env.PAM_API_KEY_ID || 'c0e75418-05f5-4c0b-b86a-b4befcbebc25',
      apiKeySecret: process.env.PAM_API_KEY_SECRET || 'dTctB7Mg7iYOoeWsOMztuzjcceHhyWoAAstPAQV4fGrM0EWy0Y4vvWjKTXjkGbDMCU1aYiAnpjvrA063f+6Hlg==',
      resourceGroupId: process.env.PAM_RESOURCE_GROUP_ID || '7b3e9a80-8253-4b42-a4ec-7ddeba77f3da',
      projectId: process.env.PAM_PROJECT_ID || 'e9fc2837-32e8-4700-9689-a8d3d3391928',
      secretId: process.env.PAM_SECRET_ID || '27ab37e0-3fee-442b-8f0f-2cdbd8cfc18e',
    };
  }

  async retrieveSecret(): Promise<string> {
    try {
      // If we have proper PAM credentials, try to fetch from vault
      if (process.env.PAM_API_KEY_ID && process.env.PAM_API_KEY_SECRET) {
        const response = await axios.get(
          `https://${this.config.domain}/secrets/resource_groups/${this.config.resourceGroupId}/projects/${this.config.projectId}/secret/${this.config.secretId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.config.apiKeySecret}`,
              'Content-Type': 'application/json',
            },
          }
        );

        return response.data.secret;
      } else {
        // Demo mode: Use fallback client secret for demonstration
        console.log('PAM demo mode: Using fallback client secret for demonstration');
        return process.env.OKTA_CLIENT_CREDENTIALS_CLIENT_SECRET || 'w-duI3IyYtEqlNKsmlR2LaRICXVUUr61sMzYHbeQ2q5_3qeoTTtSETIvzjPPLA9O';
      }
    } catch (error) {
      console.error('Error retrieving PAM secret, falling back to demo mode:', error);
      // Fallback to environment variable for demo purposes
      return process.env.OKTA_CLIENT_CREDENTIALS_CLIENT_SECRET || 'w-duI3IyYtEqlNKsmlR2LaRICXVUUr61sMzYHbeQ2q5_3qeoTTtSETIvzjPPLA9O';
    }
  }

  async getElevatedToken(scopes: string[], actAs?: string): Promise<string> {
    try {
      // First retrieve the client secret from PAM
      const clientSecret = await this.retrieveSecret();

      // Then use it to get an elevated token
      const tokenData: any = {
        grant_type: 'client_credentials',
        scope: scopes.join(' '),
      };

      if (actAs) {
        tokenData.act_as = actAs;
      }

      const response = await axios.post(
        `https://${this.config.domain}/oauth2/v1/token`,
        new URLSearchParams(tokenData),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`0oat4agvajRwbJlbU697:${clientSecret}`).toString('base64')}`,
          },
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('Error getting elevated token:', error);
      throw new Error('Failed to obtain elevated token');
    }
  }

  async checkAccessRequestStatus(requestId: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://${this.config.domain}/api/pam/v1/requests/${requestId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKeySecret}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error checking PAM request status:', error);
      throw new Error('Failed to check PAM request status');
    }
  }
}

export const pamService = new PAMService();
