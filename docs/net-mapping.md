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
and, when known, `area_id`. A control place carries `automation_id` and an
`origin` with it.

### Transitions

Every transition has an `id`, a `kind`, an `origin` (`automation_id` and the
config `path` it came from) and a list of `annotations`, each `{"name": ...,
"value": ...}`. An `environment` transition's origin is the `entity_id` alone.

Where one config element stands for several alternatives (see "Alternatives"
below), each alternative is its own transition and the ids get a suffix: `#0`,
`#1`, and so on.

| Kind | Meaning | Id |
|---|---|---|
| `trigger` | A trigger fires and starts a run. | `t:<automation_id>:triggers[n]` |
| `action` | A step that calls an action. | `t:<automation_id>:<path>` |
| `wait` | A delay or a wait for a trigger or template. | same |
| `branch` | One alternative of a `choose` or `if`, including the default. | `t:<automation_id>:<path>` of the alternative |
| `fork`, `join` | Start and end of `parallel`. | `t:<automation_id>:<path>:fork`, `:join` |
| `loop`, `exit` | Go round a `repeat` once more, or leave it. | `t:<automation_id>:<path>:loop`, `:exit` |
| `check` | Conditions hold and the run goes on: the automation's conditions, or a `condition` step. | `t:<automation_id>:conditions`, or `t:<automation_id>:<path>` |
| `stop` | A `stop` step, or conditions that do not hold. | `t:<automation_id>:<path>` for a `stop` step; `t:<automation_id>:conditions:stop` and `t:<automation_id>:<path>:stop` for the failing side of a check |
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

An arc is `{"kind", "source", "target"}` plus `"role"` on read arcs. Arcs have
no id and no origin of their own; they belong to their transition.

### Alternatives

Several arcs into one transition mean *all of them*. Whatever Home Assistant
treats as *any of them* therefore becomes several transitions between the same
control places, never several arcs on one transition:

- a trigger that names several entities, several target states, or both: one
  transition per combination;
- `wait_for_trigger` with several triggers: one `wait` transition per trigger,
  and per combination within each.

Combinations are numbered entity first: all states of the first entity, then
the next entity.

Conditions are the opposite case. A condition that names several entities
requires all of them, so it is several read arcs on the same transition.

## Mapping rules

### Triggers

| Trigger | Net |
|---|---|
| `state` with `to` | One transition per entity and target state, each with one read arc (role `trigger`) from `p:<entity>:<to>`. `from` and `for` become annotations. |
| `state` without `to`, or on an `attribute` | One transition per entity, read arc from `p:<entity>:*`. `attribute`, `from` and `to` become annotations. |
| `numeric_state` | One transition per entity, read arc from `p:<entity>:*`, annotation `guard` with the bounds. |
| `sun` | Read arc from `p:sun.sun:*`, annotation `event` (`sunset`, offset). |
| `zone` | One transition per entity, read arc from `p:<entity>:*`, annotation `event`. |
| `template` | Annotation `template`. Read arcs from `p:<entity>:*` for each entity the template refers to, when that can be determined. Listed as opaque. |
| `time`, `time_pattern`, `event`, `homeassistant`, `webhook`, `mqtt`, `calendar`, `tag`, `conversation`, `device` and any other | No input place. Annotation `event` with the platform and its settings. `device` triggers are opaque. |

Every trigger transition produces `triggered` and carries the automation's mode
as annotation `mode`. A disabled trigger yields no transition.

### Conditions of the automation

They are a check between the triggers and the first action, exactly like a
`condition` step in that position:

- a `check` transition `t:<id>:conditions` takes the token from `triggered` to
  `p:<id>:@actions[0]`, the place before the first action, and carries the
  conditions as described below;
- a `stop` transition `t:<id>:conditions:stop` takes it to `done` when they do
  not hold. It carries annotation `otherwise`.

Trigger transitions carry no conditions, so the alternatives of a trigger do
not multiply them. An automation without conditions has neither transition:
its first step consumes `triggered` directly.

| Condition | Net |
|---|---|
| `state` | Read arc (role `condition`) from `p:<entity>:<state>` for each entity; all must hold. With several states, or with `match: any`, the arcs go to `p:<entity>:*` instead, with annotation `guard`, and the condition is opaque: it is an "or". |
| `numeric_state` | Read arc from `p:<entity>:*`, annotation `guard`. |
| `sun`, `time`, `zone`, `trigger` | Annotation `guard`. `sun` and `zone` also read `p:<entity>:*`. |
| `template` | Annotation `guard` with the template, read arcs where entities can be determined. Opaque. |
| `and` | Its parts, as if listed directly. |
| `or`, `not` | Annotation `guard` holding the condition. Read arcs from `p:<entity>:*` for the entities inside. Opaque, because the net cannot say which of them must hold. |

### Actions

Steps are chained by control places. The step at `path` consumes
`p:<id>:@<path>` and produces the place before the next step, or `done` after
the last one. The place before the first step is `triggered`, or
`p:<id>:@actions[0]` when the automation has conditions.

| Step | Net |
|---|---|
| Action call with a known effect | `action` transition with a `write` arc to the effect's state place for each target entity, annotation `action`. |
| Action call with an unknown effect on its targets | `action` transition with a `write` arc to `p:<entity>:*` for each target, annotation `action`. |
| Action call with no entity target (`notify.*`, `persistent_notification.*`, ...) | `action` transition without state arcs, annotation `action`. |
| `delay` | `wait` transition, annotation `delay`. |
| `wait_for_trigger` | `wait` transition with the read arcs its triggers would have, annotation `timeout` if set. Without any trigger it is one `wait` transition without read arcs. |
| `wait_template` | `wait` transition, annotation `template`, read arcs (role `condition`) from `p:<entity>:*` for the entities the template refers to, when that can be determined: the wait ends when the template holds, which is a level, not a change. Opaque. |
| `choose`, `if` | One `branch` transition per alternative, carrying that alternative's conditions as read arcs and guards, then the alternative's steps, all ending in the place after the whole step. The default, or an implicit empty one, is a `branch` too. |
| `parallel` | A `fork` producing the first place of every branch, the branches, and a `join` consuming their last places. |
| `repeat` | See "Loops" below. |
| `condition` as a step | A pair: a `check` transition onward carrying the condition, and a `stop` transition to `done` for when it does not hold. |
| `stop` | `stop` transition to `done`. |
| `variables`, `event`, `sequence`, `set_conversation_response` | `sequence` is flattened. `event` is a `skip` with annotation `fires_event`. The others are `skip`. |
| Any other step | `skip`, opaque. |
| A disabled step | `skip` with annotation `disabled`. |
| Steps after a `stop` in the same sequence | Not translated. Listed as opaque: they cannot be reached. |

**Loops.** The place before the `repeat` step is the head of the loop.

- With a count, `while` or `for_each`, the check comes first: `loop` takes the
  token from the head into the body, the body's last step returns it to the
  head, and `exit` takes it from the head to the place after the step. The loop
  can run zero times.
- With `until`, the check comes last: the body starts at the head and ends in
  `p:<automation_id>:@<path>:end`; from there `loop` returns to the head and
  `exit` leaves. The body runs at least once.

The `while` conditions sit on `loop` and the `until` conditions on `exit`, as
read arcs and guards like any condition. The other transition of the pair
carries annotation `otherwise`. A count or `for_each` is an annotation on
`loop`, and `exit` carries `otherwise`.

The place before the body's first step follows the general rule:
`p:<automation_id>:@<path>.repeat.sequence[0]`. An empty body makes `loop`
return straight to the head. If the body always stops, a check-first loop keeps
`loop` and `exit`; an `until` loop has neither, and the repeat ends the run.

**Effects.** The table in `net/effects.py` says which state a call leads to and
is the authority. `turn_on` → `on` and `turn_off` → `off` hold only for domains
whose state really is `on` or `off`; `lock.lock` → `locked`, `lock.unlock` →
`unlocked`; `cover.open_cover` → `open`, `cover.close_cover` → `closed`. For
`homeassistant.turn_on` and `turn_off` the domain of each target entity decides.
`toggle` and everything not in the table write the `*` place.

**Targets.** Entities named directly are used as they are. Targets given as
area, floor, label or device are resolved at translation time to the entities
the call would reach: those of the action's domain, without hidden and disabled
ones. They are annotated `resolved_from`. The answer can go stale when entities
move.

**Indirection.** Calls to scripts, scenes and other automations (`script.*`,
`scene.turn_on`, `automation.trigger`, ...) are `action` transitions with
annotation `calls` naming the target. Their effects are not followed. Opaque.

### Environment

On request, the translation adds an `environment` transition with a `write` arc
for every state place that some transition reads and no automation writes.
Without these, such places could never gain a token. They are off by default,
because they are noise in the domain view. A write to an entity's `*` place does
not count as writing one of its named states.

### Reading configurations

- The older spellings (`trigger:` and `platform:`, `condition:`, `action:` and
  `service:`) are read like the current ones. Paths always use the current,
  plural names.
- An automation without an `id` whose object id equals another automation's
  `id` gets the suffix `~yaml`.
- An automation that cannot be translated at all, for instance because its
  blueprint is missing, is a record with one opaque entry whose `path` is empty.

### Change sets

The net can include the operations of a change set that is not written yet,
with `source: "proposal"`. A create is added; without an id it is called
`<change_set_id>_<index>`. An update replaces the existing automation's net and
keeps its `entity_id`. A delete removes it, together with state places that
nothing else touches.

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
12. **Alternatives multiply.** A trigger over several entities and states
    becomes one transition per combination. The net grows accordingly.
13. **Device triggers, conditions and actions** are opaque. Automations made in
    the editor use them often, so many of those will be incomplete.
14. **Events.** An event fired by one automation and awaited by another is not
    connected.
15. **Initial marking.** The net says which states exist, not which one holds
    now.

These limits fall into two groups.

- **Carried as annotations:** time, modes, values, and change versus level.
  The net keeps the information next to the element it belongs to. An
  automation that only has these is still `complete`.
- **Recorded as opaque:** logic beyond "and", templates, indirection,
  blueprints that do not resolve, device triggers and actions, steps the
  translation does not know, and steps that cannot be reached. Here the net is
  missing structure. The automation's record lists each case and `complete` is
  false.

Findings of the conflict analysis that rest on an automation that is not
`complete` are warnings, never errors.

## Export

The JSON above is the internal format. For external tools the net can be
exported as PNML (place/transition net). PNML knows neither read nor write
arcs:

- a `read` arc becomes an arc into the transition and an arc back;
- a `write` arc becomes one transition per state place of the entity that
  moves the token to the target, plus one that leaves it where it already is;
- kinds, roles, origins and annotations go into `toolspecific` elements;
- ids are `p1`, `t1` and so on, because PNML ids must be XML names; the original
  id is kept as the name.

The expansion is done at export time only. A transition that writes several
entities expands to the product of their state places. Beyond a fixed number of
variants the writes are chained through intermediate places instead, which is
no longer atomic. The exported net has no initial marking.
