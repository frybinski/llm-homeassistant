# From automation to net: the mapping (format version 1)

This is the specification of how AI Drafts turns Home Assistant automations into
a net. Conflict analysis and the domain view both work on this net, so its
simplifications bound what they can show. Every simplification is listed in the
last section.

Format version 0, used by the example data in `frontend/src/demo/`, is
superseded by this document. The example views keep using version 0 until they
are moved to real data.

## What kind of net

Two levels, with different properties.

- **One automation.** The control flow of a single run is a workflow net: one
  source place (`triggered`), one sink place (`done`), and every step on a path
  from source to sink. Triggers put a token into the source.
- **The whole house.** The nets of all automations share *state places*, one per
  entity state. The result is a place/transition net with read arcs and write
  arcs. It is not a workflow net: it has no single source and sink.

## Elements

```json
{
  "format": "ai_drafts.net",
  "version": 1,
  "automations": [],
  "places": [],
  "transitions": [],
  "arcs": []
}
```

### Automations

One record per automation, because modes, names and translation gaps belong to
the automation and not to any single net element.

```json
{
  "id": "nachtruhe_flur",
  "entity_id": "automation.nachtruhe_im_flur",
  "alias": "Nachtruhe im Flur",
  "mode": "single",
  "enabled": true,
  "source": "ui",
  "complete": true,
  "opaque": []
}
```

- `source` is `ui` (has an `id`, editable in the editor), `yaml` (no `id`) or
  `proposal` (an operation of a change set that is not written yet).
- `id` is the automation's `id`. An automation without one uses the object id of
  its entity.
- `complete` is false when anything in `opaque` limits what the net says.
- `opaque` lists what could not be expressed: `{"path": "actions[2]", "reason":
  "..."}`.

### Places

| Kind | Meaning | Id |
|---|---|---|
| `state` with a state | The entity is in this discrete state. | `p:<entity_id>:<state>` |
| `state` with `"state": null` | The entity, whatever its value. Used for numeric and other non-discrete references. | `p:<entity_id>:*` |
| `control` | A position in one run of an automation. | `p:<automation_id>:triggered`, `p:<automation_id>:done`, and `p:<automation_id>:@<path>` for the position before the step at that config path |

State places exist only for states that some automation actually refers to.
Every state place carries `entity_id`, `state` and an `origin` with `entity_id`
and, when known, `area_id`.

### Transitions

Every transition has an `id`, a `kind`, an `origin` (`automation_id` and the
config `path` it came from) and a list of `annotations`.

| Kind | Meaning | Id |
|---|---|---|
| `trigger` | A trigger fires and starts a run. | `t:<automation_id>:triggers[n]` |
| `action` | A step that calls an action. | `t:<automation_id>:<path>` |
| `wait` | A delay or a wait for a trigger or template. | same |
| `branch` | One alternative of a `choose` or `if`, including the default. | `t:<automation_id>:<path>` of the alternative |
| `fork`, `join` | Start and end of `parallel`. | `t:<automation_id>:<path>:fork`, `:join` |
| `loop`, `exit` | Go round a `repeat` once more, or leave it. | `t:<automation_id>:<path>:loop`, `:exit` |
| `stop` | A `stop` step, or a `condition` step that does not hold. | `t:<automation_id>:<path>` |
| `skip` | A step with no effect the net can express (set a variable, fire nothing). | same |
| `environment` | Something outside the automations changes a state. | `t:env:<entity_id>:<state>` |

### Arcs

| Kind | Between | Meaning |
|---|---|---|
| `consume` | control place → transition | Takes the run's token. |
| `produce` | transition → control place | Puts the run's token. |
| `read` | state place → transition | The transition needs this state and leaves it. Carries `"role"`: `trigger` or `condition`. |
| `write` | transition → state place | Sets the entity to this state, whatever it was before. On a `p:<entity_id>:*` place it means: changes the entity in a way the net does not name. |

A `read` arc with role `trigger` is sensitive to change: the transition fires
when the entity *enters* the state. With role `condition` it is sensitive to
level: the state must hold at that moment. This is how a condition on the
trigger's own entity stays distinguishable from the trigger.

A `write` arc replaces the token of every state place of the same entity. This
is a reset arc in Petri net terms. It removes the stuck token of version 0,
where "turn on" could not fire while the light was already on.

## Mapping rules

### Triggers

| Trigger | Net |
|---|---|
| `state` with `to` | Read arc (role `trigger`) from each `p:<entity>:<to>`. `from` and `for` become annotations. |
| `state` without `to` | Read arc from `p:<entity>:*`. |
| `numeric_state` | Read arc from `p:<entity>:*`, annotation `guard` with the bounds. |
| `sun` | Read arc from `p:sun.sun:*`, annotation `event` (`sunset`, offset). |
| `zone` | Read arc from `p:<entity>:*`, annotation `event`. |
| `template` | Annotation `template`. Read arcs from `p:<entity>:*` for each entity the template refers to, when that can be determined. Listed as opaque. |
| `time`, `time_pattern`, `event`, `homeassistant`, `webhook`, `mqtt`, `calendar`, `tag`, `conversation`, `device` and any other | No input place. Annotation `event` with the platform and its settings. `device` triggers are opaque. |

Every trigger transition produces `triggered` and carries the automation's mode
as annotation `mode`.

### Conditions of the automation

They attach to every trigger transition of the automation, because a run only
starts when they hold.

| Condition | Net |
|---|---|
| `state` | Read arc (role `condition`) from each `p:<entity>:<state>`. |
| `numeric_state` | Read arc from `p:<entity>:*`, annotation `guard`. |
| `sun`, `time`, `zone`, `trigger` | Annotation `guard`. `sun` and `zone` also read `p:<entity>:*`. |
| `template` | Annotation `guard` with the template, read arcs where entities can be determined. Opaque. |
| `and` | Its parts, as if listed directly. |
| `or`, `not` | Annotation `guard` holding the condition. Read arcs from `p:<entity>:*` for the entities inside. Opaque, because the net cannot say which of them must hold. |

### Actions

Steps are chained by control places. The step at `path` consumes
`p:<id>:@<path>` and produces the place before the next step, or `done` after
the last one. `triggered` is the place before the first step.

| Step | Net |
|---|---|
| Action call with a known effect | `action` transition with a `write` arc to the effect's state place for each target entity. |
| Action call with an unknown effect on its targets | `action` transition with a `write` arc to `p:<entity>:*` for each target, annotation `action`. |
| Action call with no entity target (`notify.*`, `persistent_notification.*`, ...) | `action` transition without state arcs, annotation `action`. |
| `delay` | `wait` transition, annotation `delay`. |
| `wait_for_trigger` | `wait` transition with the read arcs its triggers would have, annotation `timeout` if set. |
| `wait_template` | `wait` transition, annotation `template`. Opaque. |
| `choose`, `if` | One `branch` transition per alternative, carrying that alternative's conditions like automation conditions, then the alternative's steps, all ending in the place after the whole step. The default, or an implicit empty one, is a `branch` too. |
| `parallel` | A `fork` producing the first place of every branch, the branches, and a `join` consuming their last places. |
| `repeat` | The body, then `loop` back to its first place and `exit` to the place after the step. The count or the `while`/`until` conditions are annotations and guards on these two. |
| `condition` as a step | An `action`-free pair: a `skip` transition onward carrying the condition, and a `stop` transition to `done` for when it does not hold. |
| `stop` | `stop` transition to `done`. |
| `variables`, `event`, `sequence`, `set_conversation_response` | `sequence` is flattened. `event` is a `skip` with annotation `fires_event`. The others are `skip`. |
| Any other step | `skip`, opaque. |

**Effects.** A small explicit table says which state a call leads to:
`turn_on` → `on`, `turn_off` → `off` for every domain that has them; `lock.lock`
→ `locked`, `lock.unlock` → `unlocked`; `cover.open_cover` → `open`,
`cover.close_cover` → `closed`; `toggle` and everything not in the table → the
`*` place, with annotation `action`.

**Targets.** Entities named directly are used as they are. Targets given as
area, floor, label or device are resolved to entities at translation time and
annotated `resolved_from`. The answer can go stale when entities move.

**Indirection.** Calls to scripts, scenes and other automations (`script.*`,
`scene.turn_on`, `automation.trigger`, ...) are `action` transitions with
annotation `calls` naming the target. Their effects are not followed. Opaque.

### Environment

On request, the translation adds an `environment` transition with a `write` arc
for every state place that some transition reads and no automation writes.
Without these, such places could never gain a token. They are off by default,
because they are noise in the domain view.

## What the net does not say

1. **Time.** Delays, `for`, timeouts and times of day are annotations. The net
   knows order, not duration.
2. **Modes.** `single`, `restart`, `queued` and `parallel` are annotations. The
   net lets a second run start while the first one is under way, which is the
   behaviour of `parallel` only.
3. **Values.** Numeric states, attributes and everything a template computes
   collapse into the `*` place of the entity plus an annotation.
4. **Logic beyond "and".** `or` and `not` are kept as guards, not as structure.
5. **Templates.** A template is opaque. The entities it refers to are linked
   when they can be determined, and only then.
6. **Indirection.** What a script, scene or triggered automation does is not
   followed.
7. **Targets by area, floor, label or device** are resolved once, at
   translation time.
8. **Derived states.** Groups and template entities change with their sources.
   The net does not know that.
9. **Blueprints.** An automation made from a blueprint is translated from its
   resolved configuration when that is available, and is otherwise one opaque
   transition.
10. **Effects.** Only the calls in the effect table lead to a named state.
11. **Change versus level.** The distinction between trigger and condition is
    carried by the arc's role, not by the token game.

Whenever one of these applies to an automation, its record says so in `opaque`
and `complete` is false. Findings of the conflict analysis that rest on such an
automation are warnings, never errors.

## Export

The JSON above is the internal format. For external tools the net can be
exported as PNML (place/transition net). PNML knows neither read nor write
arcs:

- a `read` arc becomes an arc into the transition and an arc back;
- a `write` arc becomes one transition per state place of the entity that
  moves the token to the target, plus one that leaves it where it already is;
- kinds, roles, origins and annotations go into `toolspecific` elements.

The expansion is done at export time only.
