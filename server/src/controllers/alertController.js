import { onRuleChanged, resolveAlertManually } from '../services/alertEngine.js';
import { acknowledgeAlert, listAlerts, listRules, updateRule } from '../services/alertService.js';

export async function getAlerts(req, res) {
  res.json(await listAlerts(req.validatedQuery));
}

export async function postAcknowledge(req, res) {
  const alert = await acknowledgeAlert(req.params.id);
  res.json({ alert });
}

export async function postResolve(req, res) {
  const alert = await resolveAlertManually(req.params.id);
  res.json({ alert });
}

export async function getRules(req, res) {
  res.json({ rules: await listRules() });
}

export async function patchRule(req, res) {
  const rule = await updateRule(req.params.id, req.body);
  await onRuleChanged(rule);
  res.json({ rule });
}
