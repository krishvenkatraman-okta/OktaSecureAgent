import axios from 'axios';
import * as jose from 'node-jose';
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
  private keyStore: any;
  private privateKey: any;
  private publicKey: any;

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
    this.initializeKeys();
  }

  private async initializeKeys() {
    try {
      // Generate RSA 2048-bit key pair for PAM encryption
      this.keyStore = jose.JWK.createKeyStore();
      this.privateKey = await this.keyStore.generate('RSA', 2048, {
        alg: 'RSA-OAEP-256',
        use: 'enc'
      });
      this.publicKey = this.privateKey.toJSON();
      console.log('Generated RSA key pair for PAM secret encryption');
    } catch (error) {
      console.error('Error generating RSA keys:', error);
      // Continue without keys for demo fallback
    }
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

  private async getOktaPAMPublicKey(): Promise<any> {
    try {
      console.log('Downloading Okta PAM public key for encryption...');
      const bearerToken = await this.generateJWT();
      
      const response = await axios.get(
        `https://${this.config.domain}/v1/teams/${this.config.teamName}/vault/jwks.json`,
        {
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const jwks = response.data;
      const oktaKey = jwks.keys[0]; // Use first key (typically the current one)
      console.log('Okta PAM public key downloaded successfully');
      
      return oktaKey;
    } catch (error) {
      console.error('Error downloading Okta PAM public key:', error.response?.data || error.message);
      throw new Error('Failed to download Okta PAM public key');
    }
  }

  private async decryptJWESecret(encryptedJWE: string): Promise<string> {
    try {
      console.log('Decrypting JWE secret using private key...');
      
      // Parse JWE and decrypt using our private key
      const decrypted = await jose.JWE.createDecrypt(this.privateKey).decrypt(encryptedJWE);
      const secretValue = decrypted.payload.toString();
      
      console.log('JWE secret successfully decrypted');
      return secretValue;
    } catch (error) {
      console.error('Error decrypting JWE secret:', error);
      throw new Error('Failed to decrypt JWE secret');
    }
  }

  async retrieveSecret(): Promise<string> {
    try {
      console.log('Retrieving client credentials secret from PAM vault with RSA encryption...');
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

      // Ensure keys are initialized
      if (!this.privateKey) {
        await this.initializeKeys();
      }
      
      // Step 1: Get the service token
      const bearerToken = await this.generateJWT();
      
      // Step 2: Get Okta PAM public key for encryption
      const oktaPublicKey = await this.getOktaPAMPublicKey();
      
      // Step 3: Create public key JWE for the reveal request (using our public key)
      const publicKeyJWE = await jose.JWE.createEncrypt({
        format: 'general', // Use JWE JSON Serialization (full serialization)
        contentAlg: 'A256GCM',
        fields: { enc: 'A256GCM', alg: 'RSA-OAEP-256' }
      }, this.publicKey)
      .update(JSON.stringify({ publicKey: this.publicKey }))
      .final();
      
      // Step 4: Reveal the secret with our public key for encryption
      console.log('Making PAM reveal request with RSA public key - this should auto-trigger IGA approval workflow...');
      const revealResponse = await axios.post(
        `https://${this.config.domain}/v1/teams/${this.config.teamName}/resource_groups/${this.config.resourceGroupId}/projects/${this.config.projectId}/secrets/${this.config.secretId}/reveal`,
        {
          publicKey: publicKeyJWE
        },
        {
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Step 5: Decrypt the JWE-encrypted secret
      const encryptedSecret = revealResponse.data.encryptedSecret || revealResponse.data.secret_value;
      if (!encryptedSecret) {
        throw new Error('No encrypted secret returned from PAM API');
      }
      
      const decryptedSecret = await this.decryptJWESecret(encryptedSecret);
      console.log('PAM secret reveal and decryption completed - IGA workflow should now be auto-triggered');
      
      return decryptedSecret;
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
