
export interface OrgData {
  company: string;
  industry: string;
  country: string;
  website: string;
  teamSize: string;
}

export interface ProductData {
  projectName: string;
  productType: string; // 'website' | 'mobile' | 'backend' | 'platform'
  technology: string;
  environment: 'production' | 'staging';
}

export interface Credentials {
  projectId: string;
  sdkToken: string;
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
}