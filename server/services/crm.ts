// Mock CRM service to simulate Salesforce API with act_as delegation
export interface CRMContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone?: string;
  status: string;
  lastModified: Date;
  owner: string;
  salesRecords?: {
    totalDeals: number;
    closedWon: number;
    totalRevenue: string;
    lastDealDate: string;
    pipeline: Array<{
      opportunityId: string;
      dealName: string;
      stage: string;
      amount: string;
      closeDate: string;
    }>;
  };
}

export class CRMService {
  private contacts: Map<string, CRMContact[]> = new Map();

  constructor() {
    // Initialize with Brandon Stark's actual contact information and sales records
    this.contacts.set('brandon.stark@acme.com', [
      {
        id: 'contact_001',
        firstName: 'Brandon',
        lastName: 'Stark',
        email: 'brandon.stark@acme.com',
        company: 'Acme Corporation',
        phone: '+1-555-STARK',
        status: 'Active Customer',
        lastModified: new Date('2024-01-15T10:30:00Z'),
        owner: 'brandon.stark@acme.com',
        salesRecords: {
          totalDeals: 8,
          closedWon: 6,
          totalRevenue: '$2,450,000',
          lastDealDate: '2024-01-10',
          pipeline: [
            {
              opportunityId: 'OPP-2024-001',
              dealName: 'Enterprise Security Suite',
              stage: 'Negotiation',
              amount: '$850,000',
              closeDate: '2024-02-15'
            },
            {
              opportunityId: 'OPP-2024-002',
              dealName: 'Cloud Migration Services',
              stage: 'Proposal',
              amount: '$320,000',
              closeDate: '2024-03-01'
            }
          ]
        }
      },
      {
        id: 'contact_002',
        firstName: 'Arya',
        lastName: 'Stark',
        email: 'arya.stark@winterfell.com',
        company: 'Winterfell Industries',
        phone: '+1-555-WOLF',
        status: 'Qualified Lead',
        lastModified: new Date('2024-01-16T14:22:00Z'),
        owner: 'brandon.stark@acme.com',
        salesRecords: {
          totalDeals: 2,
          closedWon: 1,
          totalRevenue: '$75,000',
          lastDealDate: '2023-12-20',
          pipeline: [
            {
              opportunityId: 'OPP-2024-003',
              dealName: 'Identity Management Platform',
              stage: 'Discovery',
              amount: '$180,000',
              closeDate: '2024-04-15'
            }
          ]
        }
      },
      {
        id: 'contact_003',
        firstName: 'Jon',
        lastName: 'Snow',
        email: 'jon.snow@nightswatch.org',
        company: 'Night\'s Watch Security',
        phone: '+1-555-WALL',
        status: 'Prospect',
        lastModified: new Date('2024-01-17T09:15:00Z'),
        owner: 'brandon.stark@acme.com',
        salesRecords: {
          totalDeals: 0,
          closedWon: 0,
          totalRevenue: '$0',
          lastDealDate: 'N/A',
          pipeline: [
            {
              opportunityId: 'OPP-2024-004',
              dealName: 'Zero Trust Security Assessment',
              stage: 'Prospecting',
              amount: '$45,000',
              closeDate: '2024-05-01'
            }
          ]
        }
      }
    ]);
  }

  async getContacts(actAs: string, accessToken: string): Promise<CRMContact[]> {
    // Verify the access token contains the act_as claim
    if (!this.validateTokenActAs(accessToken, actAs)) {
      throw new Error('Invalid delegation token');
    }

    const contacts = this.contacts.get(actAs) || [];
    return contacts;
  }

  async getContact(contactId: string, actAs: string, accessToken: string): Promise<CRMContact | null> {
    console.log(`CRM getContact called with contactId: ${contactId}, actAs: ${actAs}`);
    console.log(`Available contacts for ${actAs}:`, this.contacts.get(actAs));
    
    // Verify the access token contains the act_as claim
    if (!this.validateTokenActAs(accessToken, actAs)) {
      throw new Error('Invalid delegation token');
    }

    const contacts = this.contacts.get(actAs) || [];
    console.log(`Found ${contacts.length} contacts for ${actAs}`);
    console.log(`Looking for contact ID: ${contactId}`);
    
    const contact = contacts.find(c => c.id === contactId);
    console.log(`Found contact:`, contact);
    
    return contact || null;
  }

  async createContact(contactData: Omit<CRMContact, 'id' | 'lastModified'>, actAs: string, accessToken: string): Promise<CRMContact> {
    // Verify the access token contains the act_as claim and write scope
    if (!this.validateTokenActAs(accessToken, actAs) || !this.validateTokenScope(accessToken, 'crm.write')) {
      throw new Error('Invalid delegation token or insufficient permissions');
    }

    const contacts = this.contacts.get(actAs) || [];
    const newContact: CRMContact = {
      ...contactData,
      id: `contact_${Date.now()}`,
      lastModified: new Date(),
    };

    contacts.push(newContact);
    this.contacts.set(actAs, contacts);

    return newContact;
  }

  async updateContact(contactId: string, updates: Partial<CRMContact>, actAs: string, accessToken: string): Promise<CRMContact | null> {
    // Verify the access token contains the act_as claim and write scope
    if (!this.validateTokenActAs(accessToken, actAs) || !this.validateTokenScope(accessToken, 'crm.write')) {
      throw new Error('Invalid delegation token or insufficient permissions');
    }

    const contacts = this.contacts.get(actAs) || [];
    const contactIndex = contacts.findIndex(c => c.id === contactId);

    if (contactIndex === -1) {
      return null;
    }

    const updatedContact = {
      ...contacts[contactIndex],
      ...updates,
      lastModified: new Date(),
    };

    contacts[contactIndex] = updatedContact;
    this.contacts.set(actAs, contacts);

    return updatedContact;
  }

  private validateTokenActAs(accessToken: string, expectedActAs: string): boolean {
    console.log(`🔍 CRM validateTokenActAs called with:`, { accessToken: accessToken?.substring(0, 20) + '...', expectedActAs });
    
    // Handle undefined or null tokens
    if (!accessToken) {
      console.error('❌ Access token is undefined or null');
      return false;
    }
    
    // For demo purposes, accept any demo elevated tokens
    if (accessToken.startsWith('demo_elevated_token_')) {
      console.log('Demo mode: Accepting demo elevated token for CRM access');
      return true;
    }
    
    // For real OAuth tokens from Okta, we'll accept them for the demo
    // In production, this would properly decode and validate the JWT
    console.log('Real OAuth token detected - validating for demo workflow');
    console.log('Token parts count:', accessToken.split('.').length);
    
    // Check if it looks like a real JWT token (3 parts separated by dots)
    if (accessToken.split('.').length === 3) {
      console.log('✅ Real OAuth JWT token accepted for CRM access');
      return true;
    } else {
      console.log('❌ Token does not have 3 parts, not a valid JWT');
    }
    
    // Fallback to mock validation for other token formats
    try {
      const payload = this.mockDecodeToken(accessToken);
      return payload.act_as === expectedActAs;
    } catch (error) {
      console.error('❌ Token validation failed:', error);
      return false;
    }
  }

  private validateTokenScope(accessToken: string, requiredScope: string): boolean {
    // For demo purposes, accept any demo elevated tokens
    if (accessToken.startsWith('demo_elevated_token_')) {
      console.log('Demo mode: Accepting demo elevated token scope for CRM access');
      return true;
    }
    
    // For real OAuth tokens from Okta, accept them for demo workflow
    if (accessToken.split('.').length === 3) {
      console.log('✅ Real OAuth JWT token accepted for CRM scope validation');
      return true;
    }
    
    // Fallback to mock validation for other token formats
    try {
      const payload = this.mockDecodeToken(accessToken);
      const scopes = payload.scope?.split(' ') || [];
      return scopes.includes(requiredScope);
    } catch (error) {
      console.error('❌ Token scope validation failed:', error);
      return false;
    }
  }

  private mockDecodeToken(token: string): any {
    // Mock JWT decoding - in real implementation, use a proper JWT library
    // This is a simplified simulation
    if (token.includes('act_as')) {
      return {
        act_as: 'brandon.stark@acme.com',
        scope: 'crm.read crm.write',
        exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes from now
      };
    }
    return {
      scope: 'crm.read',
      exp: Math.floor(Date.now() / 1000) + (15 * 60),
    };
  }
}

export const crmService = new CRMService();
