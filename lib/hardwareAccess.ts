import type { HardwareProjectMeta } from "./hardwareTypes";

export function canViewProject(
  meta: HardwareProjectMeta,
  viewerSub: string | null
): boolean {
  if (meta.visibility === "private") {
    return viewerSub === meta.ownerSub;
  }
  return true;
}

export function canEditProject(
  meta: HardwareProjectMeta,
  viewerSub: string | null
): boolean {
  return viewerSub === meta.ownerSub;
}
