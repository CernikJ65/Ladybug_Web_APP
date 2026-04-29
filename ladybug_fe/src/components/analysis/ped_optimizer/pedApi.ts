/**
 * Volani PED API + serializace formData.
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/pedApi.ts
 */
import type { PedApiResult, MountingType } from './pedTypes';

const API = 'http://127.0.0.1:8000/api/ped-optimizer';

export interface PedRequest {
  hbjson: File;
  epw: File;
  budget: number;
  heatingSetpoint: number;
  ashpCost: number;
  gshpCost: number;
  pvCostPerPanel: number;
  pvEfficiency: number;
  mountingType: MountingType;
}

export async function runPedAnalysis(
  req: PedRequest,
): Promise<PedApiResult> {
  const fd = new FormData();
  fd.append('hbjson_file', req.hbjson);
  fd.append('epw_file', req.epw);
  fd.append('budget_czk', req.budget.toString());
  fd.append('heating_setpoint_c', req.heatingSetpoint.toString());
  fd.append('ashp_cost', req.ashpCost.toString());
  fd.append('gshp_cost', req.gshpCost.toString());
  fd.append('pv_cost_per_panel', req.pvCostPerPanel.toString());
  fd.append('pv_efficiency', (req.pvEfficiency / 100).toString());
  fd.append('mounting_type', req.mountingType);
  const res = await fetch(`${API}/analyze`, { method: 'POST', body: fd });
  if (!res.ok) {
    const e = await res.json();
    throw new Error(e.detail || 'Chyba serveru');
  }
  return await res.json();
}
