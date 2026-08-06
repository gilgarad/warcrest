export type ResourceId = "gold" | "wood" | "food" | "metal" | "research" | "gunpowder" | "fuel";

export type ResourceTierId = "stone" | "copper" | "bronze" | "iron" | "steel" | "alloy" | "graphite" | "smokeless" | "coal" | "oil";

export interface ResourceDef {
  id: ResourceId;
  label: string;
  mvpEnabled: boolean;
  description: string;
  lateGameNotes?: string;
}

export const RESOURCES: ResourceDef[] = [
  {
    id: "gold",
    label: "금",
    mvpEnabled: true,
    description: "고용, 연구, 시대 진입, 거점 업그레이드의 기본 화폐.",
  },
  {
    id: "wood",
    label: "목재",
    mvpEnabled: true,
    description: "초중반 건설, 방어시설, 기본 고용 비용에 쓰이는 건축 자원.",
  },
  {
    id: "food",
    label: "식량",
    mvpEnabled: true,
    description: "웨이브 출전과 전선 유지에 직접 소모되는 운영 자원.",
  },
  {
    id: "metal",
    label: "금속",
    mvpEnabled: true,
    description: "병종 업그레이드, 연구 일꾼, 중후반 건물 강화에 쓰이는 군수 자원.",
    lateGameNotes: "석기 -> 동 -> 청동 -> 철 -> 강철 -> 합금 흐름으로 확장.",
  },
  {
    id: "research",
    label: "연구",
    mvpEnabled: true,
    description: "연구 일꾼이 생산하며 본진 연구 패널에서 병력 공방 업그레이드에 쓰이는 연구 포인트.",
  },
  {
    id: "gunpowder",
    label: "화약",
    mvpEnabled: false,
    description: "후반 총기/화포 병종과 화약 계통 연구소에 쓰이는 자원.",
    lateGameNotes: "흑연 -> 무연 계열로 진화.",
  },
  {
    id: "fuel",
    label: "연료",
    mvpEnabled: false,
    description: "후반 기계화/산업 가속 연구와 일부 고급 병종 유지에 쓰이는 자원.",
    lateGameNotes: "석탄 -> 오일 계열로 진화.",
  },
];

export const MVP_RESOURCE_IDS: ResourceId[] = RESOURCES.filter((resource) => resource.mvpEnabled).map((resource) => resource.id);

export function getResource(id: ResourceId): ResourceDef {
  const found = RESOURCES.find((resource) => resource.id === id);
  if (!found) throw new Error(`Unknown resource: ${id}`);
  return found;
}
