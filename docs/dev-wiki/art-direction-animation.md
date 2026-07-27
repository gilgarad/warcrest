# Art Direction: Unit Motion And Battle Staging

This page fixes the visual/gameplay interpretation for the current `Warcrest`
lane-battle prototype before more code is written.

## Why This Exists

Recent iterations improved camera angle, unit art, and basic combat motion, but
they still missed two core requirements:

1. Unit motion must look like **actual walking and attacking**, not just a
   still image being translated, rotated, or bobbed.
2. Lane combat must look like a **clustered melee** where rear units search for
   open side/front engagement spots instead of waiting in a single file.

This document is the reference point for the next animation/combat rewrite.

## Visual Standard

Use these concept boards as the art-direction baseline:

- [Stone Age Unit Motion Sheet](../../public/assets/concepts/stone-age-unit-motion-sheet.png)
- [Warcrest Battlefield Direction Board](../../public/assets/concepts/warcrest-battlefield-direction-board.png)
- [Object Battlefield Layout Sketch](../../public/assets/concepts/warcrest-object-battlefield-layout-sketch.png)

## Battlefield Composition Standard

The object-based battlefield must preserve the broad, high-oblique RTS
composition established by `lane-battlefield-bg-wide-v2.png`.

- Keep the long bottom-left to upper-right lane readable across several camera
  screens. Do not replace it with a low-angle horizon view.
- Use the object-ready background plate
  `lane-battlefield-object-base-v4.png`. Near-lane towers and bases are separate
  sprites; distant cliffs, rivers, forests, walls, and ruins may remain baked
  into the background.
- Put both bases and all three capture towers on authored road foundation
  centers. The lane uses a multi-node path so movement follows the road's
  gentle bends instead of cutting across it as one straight line.
- Stone-age tower display height is about `2.3x` a regular unit sprite. A base
  is larger than a tower but must not dominate the camera.
- Sort units, towers, bases, and near-lane obstacles with the same ground
  contact `y` depth rule. A unit behind a tower must be occluded by it; a unit
  in front must draw over the tower base.
- Camera default zoom is intentionally wider than the earlier prototype. Map
  drag remains available for inspecting the full lane.

## Unit Animation Direction

For stone-age units, the minimum acceptable motion is:

- `Idle`: weight shift, breathing, slight weapon/pack settle
- `Walk A / Walk B`: alternating arm swing and leg crossing
- `Attack`: committed forward strike silhouette
- `Hit`: backward recoil and loss of balance

What is explicitly **not enough**:

- whole-sprite bob only
- whole-sprite rotation only
- whole-sprite lunge only
- any combination of the above without readable limb alternation

## Preferred Implementation Direction

Priority order:

1. **Frame animation** per unit type:
   - small authored pose set
   - easiest way to get believable limb motion fast
2. **Part-split rig** only if frame animation becomes too heavy:
   - torso, front arm, back arm, front leg, back leg, weapon/pack
   - driven by a simple walk/attack timeline

Given the current repo state, frame animation is the faster path to a visible
result.

## Combat Staging Direction

The desired combat read is:

- units do not stop just because the very front slot is occupied
- rear units look for adjacent side slots
- melee blobs widen around the contact point
- support units stay just behind the active cluster
- battlefield contact should read like a small scrum, not two single-file lines

## Gameplay Interpretation

The combat solver should move toward:

1. choose a nearby enemy cluster, not just one nearest enemy
2. reserve one of several local engagement slots around that target
3. move into the reserved slot
4. if the slot is blocked, search another nearby slot
5. if no slot is available, compress behind allies without freezing

This is a structural change, not a parameter-tuning problem.

## Immediate Next Build Goals

1. Replace stone-age unit motion with actual walk/attack pose animation.
2. Add local engagement slots around melee contact.
3. Make rear units flow into side slots instead of idling behind the first row.
4. Keep the current zoomed-out, readable battlefield framing.
