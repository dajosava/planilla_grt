export const OPS_AREAS=["Pista","Baños","Tienda","Caja","Seguridad","Mantenimiento","General"] as const;
export type OpsArea=(typeof OPS_AREAS)[number];
