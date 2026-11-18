# Showcase example data

Fixed example data for the panel showcase (milestone M0). Nothing here is read
from or written to Home Assistant. The JSON files are the single source: the
frontend imports them at build time, and `tests/test_demo_data.py` reads them
from this directory.

| File | Content |
|---|---|
| `house.json` | Three rooms (areas) and nine entities with name, `mdi:` icon and current state. `area_id: null` means no room. |
| `automations.json` | The four existing automations in Home Assistant's automation config format. |
| `changesets.json` | Four change sets in the format of `ChangeSet.to_dict()`: the prepared proposal (`checked`, one `warning` finding) and three history entries (`applied`, `discarded`, `failed`). The first entry is the proposal. |
| `net.json` | The net of the four existing automations. |
| `net-proposal.json` | Net fragment of the prepared proposal. It refers to places of `net.json` by id and adds its own. The panel merges both by concatenating `places`, `transitions` and `arcs`. |

All example text (names, aliases, requests, finding messages) is German.

## Net format, version 0

**This format is provisional.** The real mapping from automations to nets is
designed in milestone M2, and these files will probably be regenerated then.
Do not build on the format.

```json
{
  "format": "ai_drafts.net",
  "version": 0,
  "places": [{"id": "p:light.flurlicht:on", "kind": "state", "entity_id": "light.flurlicht", "state": "on", "label": "Flurlicht an", "origin": {"entity_id": "light.flurlicht", "area_id": "flur"}}],
  "transitions": [{"id": "t:nachtruhe_flur:trigger:0", "kind": "trigger", "label": "Flurlicht geht an", "origin": {"automation_id": "nachtruhe_flur", "path": "triggers[0]", "entity_id": "light.flurlicht", "area_id": "flur"}, "annotations": [{"type": "mode", "value": "single"}]}],
  "arcs": [{"source": "p:light.flurlicht:on", "target": "t:nachtruhe_flur:trigger:0", "kind": "read"}]
}
```

- Places have `kind` `state` (with `entity_id` and `state`) or `control`.
- Transitions have `kind` `trigger` or `action`, and `annotations`
  (`{"type", "value"}`; types used: `mode`, `delay`, `event`; `guard` is
  reserved for conditions that are not a discrete state).
- Arcs have `kind` `read`, `consume` or `produce` and always join a place and a
  transition. Their direction is given by `source` and `target`.
- Every place and transition carries an `origin` (`automation_id`, `path` into
  the automation config, `entity_id`, `area_id`; whatever applies). The domain
  view is derived from these references.

### Mapping rules (applied by hand)

1. One **state place** per (entity, discrete state), only for states that some
   trigger, condition or action uses. Id `p:<entity_id>:<state>`.
2. Per automation one **control place** `p:<automation_id>:triggered`, plus
   `p:<automation_id>:step:<n>` between consecutive action steps. `<n>` is the
   index of the following step in the `actions` list, so the place is consumed
   by `t:<automation_id>:action:<n>`.
3. Each **trigger** is a transition `t:<automation_id>:trigger:<n>`. A state
   trigger reads its state place (`read` arc) and produces the `triggered`
   place. A trigger without an entity state behind it (the 23:00 time trigger)
   has no input place and carries an `event` annotation.
4. A **condition** on a discrete state is a `read` arc from its state place
   into every trigger transition of that automation.
5. Each **action step that writes state** is a transition
   `t:<automation_id>:action:<n>` (`<n>` is the index in `actions`). It consumes
   the previous control place, produces the next one (none after the last
   step), consumes the entity's other state place and produces the target state
   place.
6. A **delay** is a `delay` annotation on the action transition that follows the
   wait; the delay step itself has no transition. The **mode** is a `mode`
   annotation on each trigger transition.

### Known simplifications

- "Turn on" consumes the `off` place of the entity. If the light is already on,
  the transition is not enabled and the control token would get stuck. A
  faithful model needs a read-and-write or a choice between alternatives.
- Only entities with two discrete states are modelled. Numeric states
  (brightness, temperature), templates, `choose`/`if`, scripts, scenes and
  targets by area or label are not expressible.
- Modes are annotations only. `restart` does not cancel anything in the net.
- Delays are annotations only; the net has no time.
- A condition and the trigger of the same automation that name the same entity
  cannot be told apart in the derived domain view, because both are `read`
  arcs into the trigger transition. The trigger entity is taken from the
  transition's `origin.entity_id`.
- The alias of an automation is not part of the net. The panel looks it up by
  `automation_id`.
