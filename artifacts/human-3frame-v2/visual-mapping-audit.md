# Human unit visual mapping audit

Audit basis: `UNIT_STATS` label/texture mapping, registry prefix mapping, uncut
five-slot source strips, and the generated production contact sheet. `rifleman`
uses its separately approved source; the remaining rows use the roster installer.

| Unit ID | Game label | Required visual identity | Source/result |
| --- | --- | --- | --- |
| `stone_slinger` | 투석 | sling | PASS |
| `stone_axeman` | 도끼 | stone axe | PASS |
| `bronze_swordsman` | 청동검 | bronze sword and round shield | PASS; standalone unclipped attack source |
| `bronze_spearman` | 청동창 | bronze spear and round shield | PASS; standalone unclipped attack source |
| `archer` | 활 | bow | PASS |
| `iron_swordsman` | 철검 | iron sword and kite shield | PASS; standalone unclipped attack source |
| `iron_spearman` | 철창 | iron spear | PASS |
| `musketeer` | 총병 | matchlock musket | PASS; incorrect grenade art replaced |
| `pikeman` | 장창병 | long pike, no firearm | PASS; incorrect rifle art replaced; standalone unclipped attack source |
| `rifleman` | 소총병 I | early rifle | PASS; separately approved rifleman contract |
| `grenadier` | 척탄병 I | round hand grenade, no firearm | PASS; incorrect rifle art replaced |
| `rifleman_late` | 소총병 II | late rifle | PASS |
| `grenadier_late` | 척탄병 II | cylindrical hand grenade, no firearm | PASS; incorrect rifle art replaced |
| `infantry` | 보병 | service rifle | PASS |
| `machine_gunner` | 기관총병 | machine gun | PASS |
| `shock_trooper` | 돌격병 | assault weapon | PASS |
| `automatic_rifleman` | 자동소총병 | automatic rifle | PASS |
| `support_gunner` | 지원화기병 | support weapon | PASS |
| `mobile_infantry` | 기동병 | carbine | PASS |
| `special_forces` | 특수보병 | special-operations rifle | PASS |
| `heavy_gunner` | 중화기병 | heavy weapon | PASS |
| `breakthrough_trooper` | 돌파병 | assault rifle | PASS |

## Attack-frame checks

- The installer reads attack poses from an expanded source region instead of
  cutting at the fixed fifth-slot boundary.
- Standalone attack sources are used where the original strip itself lacked
  safe outer-canvas room: bronze swordsman, bronze spearman, iron swordsman,
  and pikeman.
- Every installed production attack passed non-empty alpha, eight-pixel canvas
  margins, and roster contact-sheet review. Standalone sources additionally
  passed a 32-pixel minimum source-margin check on all four sides.
- Team accent geometry is clipped to existing opaque sprite pixels, preventing
  a bbox-derived marker from floating beside wide attack poses.
