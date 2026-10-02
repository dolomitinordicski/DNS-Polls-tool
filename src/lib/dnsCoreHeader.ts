import { collection, getDocs } from 'firebase/firestore';
import { dnsCoreDb } from './dnsCore';

export type DNSCoreHeaderStatus =
  | { state: 'loading' }
  | { state: 'ready'; reportingAreas: number; organizations: number }
  | { state: 'error' };

export async function probeDNSCoreHeader(): Promise<DNSCoreHeaderStatus> {
  try {
    const [reportingAreas, organizations] = await Promise.all([
      getDocs(collection(dnsCoreDb, 'reportingAreas')),
      getDocs(collection(dnsCoreDb, 'organizations')),
    ]);
    return {
      state: 'ready',
      reportingAreas: reportingAreas.size,
      organizations: organizations.size,
    };
  } catch {
    return { state: 'error' };
  }
}
