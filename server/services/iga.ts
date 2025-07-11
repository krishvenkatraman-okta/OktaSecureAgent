import axios from 'axios';

export interface IGAConfig {
  domain: string;
  apiToken: string;
}

export class IGAService {
  private config: IGAConfig;

  constructor() {
    this.config = {
      domain: process.env.OKTA_DOMAIN || 'fcxdemo.okta.com',
      apiToken: process.env.OKTA_API_TOKEN || '00R8Oroauby567d6O2oO04L7fYM44fOxj83U9p-ftm',
    };
  }

  async createAccessRequest(requestData: {
    targetUser: string;
    requestedScope: string;
    justification: string;
    approverId?: string;
  }): Promise<any> {
    try {
      const response = await axios.post(
        `https://${this.config.domain}/api/iga/governance/api/v1/requests`,
        {
          requestType: 'access',
          targetUser: requestData.targetUser,
          requestedResource: requestData.requestedScope,
          justification: requestData.justification,
          approverId: requestData.approverId || 'sarah.chen@acme.com',
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
      console.error('Error creating IGA access request:', error);
      throw new Error('Failed to create IGA access request');
    }
  }

  async getAccessRequest(requestId: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://${this.config.domain}/api/iga/governance/api/v1/requests/${requestId}`,
        {
          headers: {
            'Authorization': `SSWS ${this.config.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching IGA access request:', error);
      throw new Error('Failed to fetch IGA access request');
    }
  }

  async listAccessRequests(filters?: any): Promise<any> {
    try {
      const response = await axios.get(
        `https://${this.config.domain}/api/iga/governance/api/v1/requests`,
        {
          headers: {
            'Authorization': `SSWS ${this.config.apiToken}`,
            'Content-Type': 'application/json',
          },
          params: filters,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error listing IGA access requests:', error);
      throw new Error('Failed to list IGA access requests');
    }
  }

  async approveAccessRequest(requestId: string, approverId: string): Promise<any> {
    try {
      const response = await axios.post(
        `https://${this.config.domain}/api/iga/governance/api/v1/requests/${requestId}/approve`,
        {
          approverId,
          decision: 'approved',
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
      console.error('Error approving IGA access request:', error);
      throw new Error('Failed to approve IGA access request');
    }
  }

  async denyAccessRequest(requestId: string, approverId: string, reason: string): Promise<any> {
    try {
      const response = await axios.post(
        `https://${this.config.domain}/api/iga/governance/api/v1/requests/${requestId}/deny`,
        {
          approverId,
          decision: 'denied',
          reason,
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
      console.error('Error denying IGA access request:', error);
      throw new Error('Failed to deny IGA access request');
    }
  }

  async getCatalogEntries(userId: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://${this.config.domain}/api/iga/governance/api/v2/catalogs/default/user/${userId}/entries`,
        {
          headers: {
            'Authorization': `SSWS ${this.config.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching catalog entries:', error);
      throw new Error('Failed to fetch catalog entries');
    }
  }
}

export const igaService = new IGAService();
