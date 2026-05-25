export type AreaIconKey = "cone";

const areaIconUrls: Record<AreaIconKey, string> = {
  cone: new URL("./assets/areas/wakfu/area-con.png", import.meta.url).href,
};

export function getAreaIconSrc(iconKey: AreaIconKey): string {
  return areaIconUrls[iconKey];
}
