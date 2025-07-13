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
}

export class CRMService {
  private contacts: Map<string, CRMContact[]> = new Map();

  constructor() {
    // Initialize with sample data for brandon.stark@acme.com
    this.contacts.set('brandon.stark@acme.com', [
      {
        id: 'contact_001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        company: 'Example Corp',
        phone: '+1-555-0123',
        status: 'Active',
        lastModified: new Date('2024-01-15T10:30:00Z'),
        owner: 'brandon.stark@acme.com',
      },
      {
        id: 'contact_002',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@techco.com',
        company: 'TechCo Inc',
        phone: '+1-555-0456',
        status: 'Lead',
        lastModified: new Date('2024-01-16T14:22:00Z'),
        owner: 'brandon.stark@acme.com',
      },
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
    // For demo purposes, accept any demo elevated tokens
    if (accessToken.startsWith('demo_elevated_token_')) {
      console.log('Demo mode: Accepting demo elevated token for CRM access');
      return true;
    }
    
    // In a real implementation, this would decode and verify the JWT token
    // For now, we'll simulate the validation
    try {
      // Mock JWT payload validation
      const payload = this.mockDecodeToken(accessToken);
      return payload.act_as === expectedActAs;
    } catch (error) {
      return false;
    }
  }

  private validateTokenScope(accessToken: string, requiredScope: string): boolean {
    // For demo purposes, accept any demo elevated tokens
    if (accessToken.startsWith('demo_elevated_token_')) {
      console.log('Demo mode: Accepting demo elevated token scope for CRM access');
      return true;
    }
    
    // In a real implementation, this would decode and verify the JWT token
    // For now, we'll simulate the validation
    try {
      // Mock JWT payload validation
      const payload = this.mockDecodeToken(accessToken);
      const scopes = payload.scope?.split(' ') || [];
      return scopes.includes(requiredScope);
    } catch (error) {
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
