import { DEFAULT_UNIT_TYPE_ID, getUnitType } from "../data/unitTypes";

export interface SquadUnit {
  id: number;
  unitTypeId: string;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  attackCooldownMs: number;
  isLeader: boolean;
}

export interface DamageResult {
  targetId: number;
  died: boolean;
  leaderDown: boolean;
  promoted: boolean;
  wiped: boolean;
}

let nextMemberId = 1;

const LEVEL_XP = 100;

function scaledValue(base: number, level: number, step = 0.16): number {
  return Math.round(base * (1 + (level - 1) * step));
}

function makeUnit(unitTypeId: string, level: number, isLeader: boolean): SquadUnit {
  const def = getUnitType(unitTypeId);
  const maxHp = scaledValue(def.baseHp, level, 0.18);
  return {
    id: nextMemberId++,
    unitTypeId,
    level,
    xp: 0,
    hp: maxHp,
    maxHp,
    attackCooldownMs: 0,
    isLeader,
  };
}

export class Squad {
  leader: SquadUnit;
  followers: SquadUnit[];
  leaderLevelPoints = 0;
  leaderMana = 100;
  leaderMaxMana = 100;
  leaderXp = 0;
  leaderInvulnMs = 0;
  squadStunMs = 0;

  constructor() {
    this.leader = makeUnit("leader", 1, true);
    this.followers = [makeUnit(DEFAULT_UNIT_TYPE_ID, 1, false)];
  }

  get size(): number {
    return 1 + this.followers.length;
  }

  get combatantCount(): number {
    return this.followers.length;
  }

  get isWiped(): boolean {
    return this.followers.length <= 0 && this.leader.hp <= 0;
  }

  get allUnits(): SquadUnit[] {
    return [this.leader, ...this.followers];
  }

  addFollower(unitTypeId: string = DEFAULT_UNIT_TYPE_ID, level = 1): SquadUnit {
    const unit = makeUnit(unitTypeId, level, false);
    this.followers.push(unit);
    return unit;
  }

  tick(deltaMs: number): void {
    this.leaderMana = Math.min(this.leaderMaxMana, this.leaderMana + (deltaMs / 1000) * 7);
    this.leaderInvulnMs = Math.max(0, this.leaderInvulnMs - deltaMs);
    this.squadStunMs = Math.max(0, this.squadStunMs - deltaMs);
    this.followers.forEach((unit) => {
      unit.attackCooldownMs = Math.max(0, unit.attackCooldownMs - deltaMs);
    });
  }

  spendMana(amount: number): boolean {
    if (this.leaderMana < amount) return false;
    this.leaderMana -= amount;
    return true;
  }

  restoreMana(amount: number): void {
    this.leaderMana = Math.min(this.leaderMaxMana, this.leaderMana + amount);
  }

  healAll(total: number): void {
    const units = this.allUnits;
    if (units.length === 0) return;
    const perUnit = total / units.length;
    units.forEach((unit) => {
      unit.hp = Math.min(unit.maxHp, unit.hp + perUnit);
    });
  }

  setFollowerAttackCooldown(unitId: number, cooldownMs: number): void {
    const unit = this.followers.find((member) => member.id === unitId);
    if (unit) unit.attackCooldownMs = cooldownMs;
  }

  gainLeaderXp(amount: number): boolean {
    let leveled = false;
    this.leaderXp += amount;
    while (this.leaderXp >= LEVEL_XP) {
      this.leaderXp -= LEVEL_XP;
      this.leader.level += 1;
      this.leader.maxHp = scaledValue(getUnitType("leader").baseHp, this.leader.level, 0.18);
      this.leader.hp = Math.min(this.leader.maxHp, this.leader.hp + 18);
      this.leaderLevelPoints += 1;
      leveled = true;
    }
    return leveled;
  }

  gainFollowerXp(unitId: number, amount: number): void {
    const unit = this.followers.find((member) => member.id === unitId);
    if (!unit) return;
    unit.xp += amount;
    while (unit.xp >= LEVEL_XP) {
      unit.xp -= LEVEL_XP;
      unit.level += 1;
      const nextMaxHp = scaledValue(getUnitType(unit.unitTypeId).baseHp, unit.level, 0.18);
      unit.hp += nextMaxHp - unit.maxHp;
      unit.maxHp = nextMaxHp;
    }
  }

  damageUnit(targetId: number, amount: number): DamageResult {
    const target = this.allUnits.find((unit) => unit.id === targetId);
    if (!target) {
      return { targetId, died: false, leaderDown: false, promoted: false, wiped: false };
    }

    if (target.isLeader && this.leaderInvulnMs > 0) {
      return { targetId, died: false, leaderDown: false, promoted: false, wiped: false };
    }

    target.hp = Math.max(0, target.hp - amount);
    const died = target.hp <= 0;
    if (!died) return { targetId, died: false, leaderDown: false, promoted: false, wiped: false };

    if (target.isLeader) {
      const promoted = this.promoteNextLeader();
      return { targetId, died: true, leaderDown: true, promoted, wiped: !promoted };
    }

    this.followers = this.followers.filter((unit) => unit.id !== targetId);
    return {
      targetId,
      died: true,
      leaderDown: false,
      promoted: false,
      wiped: this.followers.length === 0 && this.leader.hp <= 0,
    };
  }

  private promoteNextLeader(): boolean {
    if (this.followers.length <= 0) return false;

    const highestLevel = Math.max(...this.followers.map((unit) => unit.level));
    const topUnits = this.followers.filter((unit) => unit.level === highestLevel);
    const byType = new Map<string, number>();
    topUnits.forEach((unit) => {
      byType.set(
        unit.unitTypeId,
        this.followers.filter((member) => member.unitTypeId === unit.unitTypeId).length
      );
    });

    let chosenType = topUnits[0].unitTypeId;
    let bestCount = -1;
    byType.forEach((count, typeId) => {
      if (count > bestCount) {
        bestCount = count;
        chosenType = typeId;
      }
    });

    const typeCandidates = topUnits.filter((unit) => unit.unitTypeId === chosenType);
    const promoted = typeCandidates[Math.floor(Math.random() * typeCandidates.length)];
    this.followers = this.followers.filter((unit) => unit.id !== promoted.id);

    promoted.isLeader = true;
    promoted.attackCooldownMs = 0;
    this.leader = promoted;
    this.leaderInvulnMs = 900;
    this.squadStunMs = 850;
    return true;
  }
}
