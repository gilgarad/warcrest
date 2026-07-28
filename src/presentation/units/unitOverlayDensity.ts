export type UnitOverlayTeam = "player" | "enemy";

export interface UnitOverlaySubject {
  id: number;
  team: UnitOverlayTeam;
  screenX: number;
  screenY: number;
  hp: number;
  maxHp: number;
  priority: boolean;
}

export type UnitOverlayMode = "detail" | "summary" | "compact" | "hidden";

export interface UnitOverlayDecision {
  mode: UnitOverlayMode;
  groupSize: number;
  hpRatio: number;
}

export interface UnitOverlayDensityOptions {
  clusterDistancePx: number;
  summaryThreshold: number;
}

const DEFAULT_OPTIONS: UnitOverlayDensityOptions = {
  clusterDistancePx: 88,
  summaryThreshold: 3,
};

function distanceBetween(a: UnitOverlaySubject, b: UnitOverlaySubject): number {
  return Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY);
}

function findClusters(
  subjects: readonly UnitOverlaySubject[],
  clusterDistancePx: number,
): UnitOverlaySubject[][] {
  const remaining = new Set(subjects.map((subject) => subject.id));
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const clusters: UnitOverlaySubject[][] = [];

  subjects.forEach((subject) => {
    if (!remaining.delete(subject.id)) return;
    const cluster = [subject];
    const pending = [subject];
    while (pending.length > 0) {
      const current = pending.pop()!;
      [...remaining].forEach((candidateId) => {
        const candidate = byId.get(candidateId)!;
        if (candidate.team !== current.team || distanceBetween(current, candidate) > clusterDistancePx) return;
        remaining.delete(candidateId);
        cluster.push(candidate);
        pending.push(candidate);
      });
    }
    clusters.push(cluster);
  });

  return clusters;
}

export function resolveUnitOverlayDensity(
  subjects: readonly UnitOverlaySubject[],
  options: Partial<UnitOverlayDensityOptions> = {},
): Map<number, UnitOverlayDecision> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const decisions = new Map<number, UnitOverlayDecision>();

  findClusters(subjects, config.clusterDistancePx).forEach((cluster) => {
    const totalHp = cluster.reduce((sum, subject) => sum + Math.max(0, subject.hp), 0);
    const totalMaxHp = cluster.reduce((sum, subject) => sum + Math.max(0, subject.maxHp), 0);
    const hpRatio = totalMaxHp > 0 ? totalHp / totalMaxHp : 0;
    if (cluster.length < config.summaryThreshold) {
      cluster.forEach((subject) => decisions.set(subject.id, {
        mode: subject.priority ? "detail" : "compact",
        groupSize: 1,
        hpRatio: subject.maxHp > 0 ? subject.hp / subject.maxHp : 0,
      }));
      return;
    }

    const representative = cluster.find((subject) => !subject.priority) ?? cluster[0];
    cluster.forEach((subject) => decisions.set(subject.id, {
      mode: subject.priority
        ? "detail"
        : subject.id === representative.id ? "summary" : "hidden",
      groupSize: cluster.length,
      hpRatio,
    }));
  });

  return decisions;
}
