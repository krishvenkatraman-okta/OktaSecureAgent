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
      console.log('PAM Config:', {
        domain: this.config.domain,
        teamName: this.config.teamName,
        hasApiKeyId: !!this.config.apiKeyId,
        hasApiKeySecret: !!this.config.apiKeySecret,
        hasResourceGroupId: !!this.config.resourceGroupId,
        hasProjectId: !!this.config.projectId,
        hasSecretId: !!this.config.secretId
      });
      
      // Check if all required config is available
      if (!this.config.apiKeyId || !this.config.apiKeySecret) {
        console.warn('PAM API credentials not configured, simulating PAM reveal for demo');
        console.log('Simulating PAM reveal request that would auto-trigger IGA approval workflow...');
        return 'demo-client-secret-from-pam-vault';
      }
      
      // Step 1: Get the service token
      const bearerToken = await this.generateJWT();
      
      // Step 2: Reveal the actual secret value (this should auto-trigger IGA)
      console.log('Making PAM reveal request - this should auto-trigger IGA approval workflow...');
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
      console.log('PAM secret reveal completed - IGA workflow should now be auto-triggered');
      
      return secretValue;
    } catch (error) {
      console.error('Error retrieving PAM secret:', error.response?.data || error.message);
      console.error('PAM Error Details:', error.response?.status, error.response?.statusText);
      
      // For demo purposes, simulate successful PAM reveal that would auto-trigger IGA
      console.log('PAM API call failed, but simulating successful PAM reveal for demo purposes');
      console.log('This would normally auto-trigger IGA approval workflow through Okta PAM system');
      
      // Return a mock client secret for demo - in real scenario this would come from PAM vault
      return 'demo-client-secret-from-pam-vault';
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
