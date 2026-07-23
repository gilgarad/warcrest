import { DEFAULT_UNIT_TYPE_ID } from "../data/unitTypes";

export interface SquadMember {
  id: number;
  unitTypeId: string;
}

let nextMemberId = 1;

/**
 * Squad grows via rescue (add) and shrinks via combat losses (removeFront).
 * Deliberately dumb/linear — a queue, not a formation grid — so it stays
 * easy to reason about while unit-type variety doesn't exist yet.
 */
export class Squad {
  members: SquadMember[] = [];

  constructor(initialUnitTypeId: string = DEFAULT_UNIT_TYPE_ID) {
    this.add(initialUnitTypeId);
  }

  add(unitTypeId: string = DEFAULT_UNIT_TYPE_ID): SquadMember {
    const member: SquadMember = { id: nextMemberId++, unitTypeId };
    this.members.push(member);
    return member;
  }

  removeFront(): SquadMember | undefined {
    return this.members.shift();
  }

  get size(): number {
    return this.members.length;
  }

  get isWiped(): boolean {
    return this.members.length === 0;
  }
}
