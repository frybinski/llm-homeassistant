"""Which entities a template refers to, found by reading it, not by running it.

Rendering a template (``Template.async_render_to_info``) only reports what one
render touched: it fails on the ``trigger`` variable, and ``and`` short-circuits,
so entities after a false first operand are missed. Reading the Jinja syntax
tree is independent of the current state of the house. It gives an answer only
when every reference to the state machine is a literal; otherwise it says that
the entities cannot be determined.
"""

from __future__ import annotations

from functools import lru_cache
import re
from typing import Final

from jinja2 import Environment, TemplateSyntaxError, nodes

ENTITY_ID_RE: Final = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")

# Functions whose first argument is an entity id that they read.
_FIRST_ARGUMENT: Final = frozenset(
    {"states", "is_state", "state_attr", "is_state_attr", "has_value"}
)
# Functions that read every positional argument as an entity id.
_ALL_ARGUMENTS: Final = frozenset({"expand"})
# Functions that find entities by something other than their id.
_SEARCHING: Final = frozenset(
    {
        "area_entities",
        "device_entities",
        "label_entities",
        "floor_entities",
        "integration_entities",
        "config_entry_entities",
    }
)

# The environment is only used to parse, never to render.
_ENV: Final = Environment(extensions=["jinja2.ext.loopcontrols", "jinja2.ext.do"])


def is_template(value: object) -> bool:
    """Return True when a config value contains template syntax."""
    return isinstance(value, str) and ("{{" in value or "{%" in value)


def is_entity_id(value: object) -> bool:
    """Return True for a string shaped like an entity id."""
    return isinstance(value, str) and ENTITY_ID_RE.match(value) is not None


def _const(node: nodes.Node) -> object:
    return node.value if isinstance(node, nodes.Const) else None


class _Scan:
    """One walk over a syntax tree."""

    def __init__(self) -> None:
        self.entities: set[str] = set()
        self.unknown = False

    def literal(self, node: nodes.Node, *, many: bool = False) -> None:
        """Take an entity id from a constant, or give up on anything else."""
        value = _const(node)
        if is_entity_id(value):
            self.entities.add(str(value))
        elif many and isinstance(node, nodes.List | nodes.Tuple):
            for item in node.items:
                self.literal(item)
        else:
            self.unknown = True

    def visit(self, node: nodes.Node) -> None:
        """Walk a node and everything below it."""
        if isinstance(node, nodes.Call) and isinstance(node.node, nodes.Name):
            self._call(node, node.node.name)
        elif isinstance(node, nodes.Filter) and node.name == "expand":
            self.literal(node.node, many=True)
            self._visit_all(node.args)
        elif isinstance(node, nodes.Getattr | nodes.Getitem) and self._states_access(
            node
        ):
            return
        elif isinstance(node, nodes.Name) and node.name == "states":
            # `states` on its own: iterated, filtered or passed on.
            self.unknown = True
        else:
            self._visit_all(node.iter_child_nodes())

    def _visit_all(self, children: object) -> None:
        for child in children:  # type: ignore[attr-defined]
            self.visit(child)

    def _call(self, node: nodes.Call, name: str) -> None:
        rest: list[nodes.Node] = [k.value for k in node.kwargs]
        if name in _SEARCHING:
            self.unknown = True
        elif name in _FIRST_ARGUMENT:
            if node.args:
                self.literal(node.args[0])
                rest.extend(node.args[1:])
            else:
                self.unknown = True  # states() lists everything
        elif name in _ALL_ARGUMENTS:
            if node.args:
                for arg in node.args:
                    self.literal(arg, many=True)
            else:
                self.unknown = True
        else:
            rest.extend(node.args)
        self._visit_all(rest)

    def _states_access(self, node: nodes.Getattr | nodes.Getitem) -> bool:
        """Handle ``states.light.kitchen``, ``states['light.kitchen']`` and the like.

        Return True when the node was dealt with and needs no further walking.
        """
        if (entity_id := _entity_reference(node)) is not None:
            self.entities.add(entity_id)
            return True
        if isinstance(node.node, nodes.Name) and node.node.name == "states":
            self.unknown = True  # states.light, states[some_variable]
            return True
        return False


def _key(node: nodes.Getattr | nodes.Getitem) -> object:
    return node.attr if isinstance(node, nodes.Getattr) else _const(node.arg)


def _entity_reference(node: nodes.Getattr | nodes.Getitem) -> str | None:
    """Return the entity id a ``states`` lookup names, if it is a literal."""
    inner = node.node
    if isinstance(inner, nodes.Name) and inner.name == "states":
        key = _key(node)
        return key if isinstance(node, nodes.Getitem) and is_entity_id(key) else None
    if (
        isinstance(inner, nodes.Getattr | nodes.Getitem)
        and isinstance(inner.node, nodes.Name)
        and inner.node.name == "states"
    ):
        domain, key = _key(inner), _key(node)
        entity_id = f"{domain}.{key}"
        if isinstance(domain, str) and isinstance(key, str) and is_entity_id(entity_id):
            return entity_id
    return None


@lru_cache(maxsize=1024)
def template_entities(source: str) -> frozenset[str] | None:
    """Return the entities a template reads, or None when that is not decidable.

    ``None`` means: a reference to the state machine is not a literal
    (``states(some_variable)``, ``states.light``, ``area_entities(...)``) or the
    template does not parse. An empty set is a decided answer: no entity.
    """
    try:
        tree = _ENV.parse(source)
    except TemplateSyntaxError:
        return None
    scan = _Scan()
    scan.visit(tree)
    return None if scan.unknown else frozenset(scan.entities)
