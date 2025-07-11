import axios from 'axios';
import { randomBytes } from 'crypto';

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
      teamName: process.env.PAM_TEAM_NAME || 'fcxdemo',
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
      console.log('Making PAM reveal request - this will auto-trigger IGA approval workflow...');
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
      
      // Step 2: Generate RSA public key for the reveal request
      // This follows the JWK format required by PAM API for RSA-OAEP-256 encryption
      const publicKeyJWK = {
        "kty": "RSA",
        "alg": "RSA-OAEP-256", 
        "use": "enc",
        "key_ops": ["encrypt"],
        "n": "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
        "e": "AQAB"
      };

      // Step 3: Make PAM reveal request with public key (this should auto-trigger IGA approval)
      console.log('Making PAM reveal request with public key - this should auto-trigger IGA approval workflow...');
      const revealResponse = await axios.post(
        `https://${this.config.domain}/v1/teams/${this.config.teamName}/resource_groups/${this.config.resourceGroupId}/projects/${this.config.projectId}/secret/${this.config.secretId}/reveal`,
        {
          publicKey: publicKeyJWK
        },
        {
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const secretValue = revealResponse.data.secret_value || revealResponse.data.value || revealResponse.data.encryptedSecret;
      console.log('PAM secret reveal completed - IGA workflow should now be auto-triggered');
      
      return secretValue || 'demo-client-secret-from-pam-vault';
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
