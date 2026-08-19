import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface PortalConfig {
  baseURL: string;
}

export const config: PortalConfig = {
  baseURL: process.env.BASE_URL ?? 'https://portal-qa.trialcard.com/apotex/evdi/',
};
