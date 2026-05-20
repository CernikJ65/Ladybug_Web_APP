export const PV_EFF_MIN = 19;
export const PV_EFF_MAX = 24;
export const PV_EFF_DEFAULT = 20;

/* Inverter (DC→AC). EnergyPlus aplikuje samostatne mimo system_loss_fraction.
   Defaultni honeybee/PVWatts hodnota = 0.96 → 4 % ztrata. */
export const INVERTER_LOSS = 0.04;
