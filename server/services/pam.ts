import axios from 'axios';

export interface PAMConfig {
  domain: string;
  teamName: string;
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
      domain: 'fcxdemo.pam.okta.com',
      teamName: 'fcxdemo',
      apiKeyId: process.env.PAM_API_KEY_ID || '',
      apiKeySecret: process.env.PAM_API_KEY_SECRET || '',
      resourceGroupId: process.env.PAM_RESOURCE_GROUP_ID || '',
      projectId: process.env.PAM_PROJECT_ID || '',
      secretId: process.env.PAM_SECRET_ID || '',
    };
  }

  private async generateJWT(): Promise<string> {
    try {
      console.log('Requesting service token from PAM API...');
      
      // Use the official PAM service token endpoint
      const response = await axios.post(
        `https://${this.config.domain}/v1/teams/${this.config.teamName}/service_token`,
        {
          key_id: this.config.apiKeyId,
          key_secret: this.config.apiKeySecret
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const token = response.data.bearer_token;
      console.log('PAM service token obtained successfully');
      return token;
    } catch (error) {
      console.error('Error getting PAM service token:', error.response?.data || error.message);
      throw new Error('Failed to obtain PAM service token');
    }
  }

  async retrieveSecret(): Promise<string> {
    try {
      console.log('Retrieving client credentials secret from PAM vault...');
      
      // Step 1: Get the secret metadata
      const bearerToken = await this.generateJWT();
      
      const secretResponse = await axios.get(
        `https://${this.config.domain}/v1/teams/${this.config.teamName}/resource_groups/${this.config.resourceGroupId}/projects/${this.config.projectId}/secrets/${this.config.secretId}`,
        {
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Secret metadata retrieved, now revealing secret value...');

      // Step 2: Reveal the actual secret value
      const revealResponse = await axios.post(
        `https://${this.config.domain}/v1/teams/${this.config.teamName}/resource_groups/${this.config.resourceGroupId}/projects/${this.config.projectId}/secrets/${this.config.secretId}/reveal`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const secretValue = revealResponse.data.secret_value || revealResponse.data.value;
      console.log('PAM secret successfully retrieved');
      
      return secretValue;
    } catch (error) {
      console.error('Error retrieving PAM secret:', error.response?.data || error.message);
      
      // Fallback to environment variable for demo
      const fallbackSecret = process.env.OKTA_CLIENT_CREDENTIALS_CLIENT_SECRET;
      if (fallbackSecret) {
        console.log('Using fallback client credentials from environment');
        return fallbackSecret;
      }
      
      throw new Error('Failed to retrieve PAM secret and no fallback available');
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
