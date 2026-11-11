import { getDnsStatus, setDnsProtection } from '../services/dns/dnsService.js';

export async function getStatus(req, res) {
  res.json(await getDnsStatus());
}

export async function postProtection(req, res) {
  res.json(await setDnsProtection(req.body.enabled));
}
