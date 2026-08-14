/**
 * Everything the simulation asks the presentation layer to *show*.
 *
 * The simulation loop currently calls straight into Phaser to play a sound at
 * a sprite's position, float a damage number, or start an attack animation.
 * None of those decide anything — a survey of all 47 `sprite.x/y` reads in
 * `LaneBattleScene` found that not one of them feeds a simulation decision;
 * they only supply coordinates to effects. That is what makes a headless
 * simulation reachable without rewriting the combat maths: the effects move
 * behind this interface, and the renderer resolves positions from simulation
 * state when it handles them.
 *
 * Effects are addressed by *what happened to whom* (`unitId`), never by screen
 * position, so a headless implementation can drop them and a networked client
 * can replay them from state it already has.
 */

export type SimUnitRef = number;

export interface PresentationEffects {
  /** A sound belonging to a unit — positioned at that unit by the renderer. */
  unitSfx(assetId: string, unitId: SimUnitRef, eventKey: string): void;

  /** A sound belonging to a structure. */
  structureSfx(assetId: string, structureKind: "tower" | "capture-point", structureId: number, eventKey: string): void;

  /** Floating text above a unit (damage numbers, heal amounts, labels). */
  unitToast(text: string, unitId: SimUnitRef, color: string, verticalOffset: number): void;

  /**
   * The whole "this unit just got hit" flourish — tint flash, impact ring and
   * damage number. Grouped into one call because the simulation has no opinion
   * about which of those the renderer chooses to show; it only knows a unit
   * took `damage`.
   */
  unitImpact(unitId: SimUnitRef, damage: number, color: string): void;

  /** A structure took damage: flash plus the damage number. */
  structureImpact(structureKind: "tower" | "capture-point", structureId: number, damage: number, color: string): void;

  /** Short status line for the local player. Ignored by a headless run. */
  notice(message: string): void;

  /** A sound with no position — UI feedback, capture stings, alerts. */
  globalSfx(assetId: string, eventKey: string): void;

  /**
   * The unit is moving toward a point in lane space; the renderer decides which
   * way that makes it face. Facing is presentation — it never changes the
   * outcome — but only the simulation knows where the unit is headed.
   */
  unitTravelFacing(unitId: SimUnitRef, targetProgress: number, targetLaneRow: number): void;

  /** A unit died: the renderer tears down its display objects. */
  unitDied(unitId: SimUnitRef): void;
}

/**
 * Drops every effect. Used by a headless simulation — in Node, or on a peer
 * that is fast-forwarding to catch up, where playing sounds and spawning
 * floating text would be wrong as well as wasteful.
 */
export const NULL_PRESENTATION_EFFECTS: PresentationEffects = {
  unitSfx: () => {},
  structureSfx: () => {},
  unitToast: () => {},
  unitImpact: () => {},
  structureImpact: () => {},
  notice: () => {},
  globalSfx: () => {},
  unitTravelFacing: () => {},
  unitDied: () => {},
};

/** Records what was emitted, so tests can assert on effects without a renderer. */
export class RecordingPresentationEffects implements PresentationEffects {
  readonly emitted: { kind: string; detail: Record<string, unknown> }[] = [];

  unitSfx(assetId: string, unitId: SimUnitRef, eventKey: string): void {
    this.emitted.push({ kind: "unitSfx", detail: { assetId, unitId, eventKey } });
  }

  structureSfx(assetId: string, structureKind: string, structureId: number, eventKey: string): void {
    this.emitted.push({ kind: "structureSfx", detail: { assetId, structureKind, structureId, eventKey } });
  }

  unitToast(text: string, unitId: SimUnitRef, color: string, verticalOffset: number): void {
    this.emitted.push({ kind: "unitToast", detail: { text, unitId, color, verticalOffset } });
  }

  unitImpact(unitId: SimUnitRef, damage: number, color: string): void {
    this.emitted.push({ kind: "unitImpact", detail: { unitId, damage, color } });
  }

  structureImpact(structureKind: string, structureId: number, damage: number, color: string): void {
    this.emitted.push({ kind: "structureImpact", detail: { structureKind, structureId, damage, color } });
  }

  notice(message: string): void {
    this.emitted.push({ kind: "notice", detail: { message } });
  }

  globalSfx(assetId: string, eventKey: string): void {
    this.emitted.push({ kind: "globalSfx", detail: { assetId, eventKey } });
  }

  unitTravelFacing(unitId: SimUnitRef, targetProgress: number, targetLaneRow: number): void {
    this.emitted.push({ kind: "unitTravelFacing", detail: { unitId, targetProgress, targetLaneRow } });
  }

  unitDied(unitId: SimUnitRef): void {
    this.emitted.push({ kind: "unitDied", detail: { unitId } });
  }

  clear(): void {
    this.emitted.length = 0;
  }

  countOf(kind: string): number {
    return this.emitted.filter((entry) => entry.kind === kind).length;
  }
}
