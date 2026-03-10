import jsonschema
from sqlalchemy.orm import Session
from ..models.schema import Schema, ExternalSchemaCache


# ─── Ref Inliner ──────────────────────────────────────────────────────────────

def _inline_refs(node: any, defs: dict, visited: set = None) -> any:
    """
    Recursively inline all $ref occurrences so jsonschema never has to
    resolve them at validation time.  Handles:
      - in-document defs:  "$ref": "#/$defs/goody"  or  "$ref": "#/definitions/goody"
      - bare DB keys:      "$ref": "goody"   (looked up from the defs map)
    Strips top-level $schema / $id from sub-schemas to avoid draft-version
    conflicts inside nested definitions.
    Uses a visited set to prevent infinite recursion in circular schemas.
    """
    if visited is None:
        visited = set()

    if node is None or not isinstance(node, (dict, list)):
        return node

    if isinstance(node, list):
        return [_inline_refs(item, defs, visited) for item in node]

    # ── Resolve $ref ──────────────────────────────────────────────────────────
    if "$ref" in node and isinstance(node["$ref"], str):
        ref = node["$ref"]
        key = None
        if ref.startswith("#/$defs/"):
            key = ref[len("#/$defs/"):]
        elif ref.startswith("#/definitions/"):
            key = ref[len("#/definitions/"):]
        elif not ref.startswith("#") and not ref.startswith("http"):
            # Bare schema key (e.g. "goody" – looked up from defs / DB)
            key = ref

        if key and key in defs and key not in visited:
            next_visited = visited | {key}
            def_body = {k: v for k, v in defs[key].items()
                        if k not in ("$schema", "$id")}
            # Merge any sibling keywords from the $ref node itself (rare but valid)
            siblings = {k: v for k, v in node.items() if k != "$ref"}
            return _inline_refs({**def_body, **siblings}, defs, next_visited)

    # ── Walk all keys (but don't recurse into $defs/$definitions themselves) ──
    result = {}
    for k, v in node.items():
        result[k] = _inline_refs(v, defs, visited)
    return result


def _build_defs(schema: dict, db: Session) -> dict:
    """
    Build a flat map of every definition name → schema body by merging:
      1. $defs / definitions from the root schema itself
      2. Every schema stored in the database (keyed by `key`)
    """
    root_defs = schema.get("$defs", schema.get("definitions", {})) or {}

    db_schemas = db.query(Schema).all()
    db_defs = {s.key: s.content for s in db_schemas if s.content}

    # Root schema's own $defs take precedence over DB schemas with the same key
    return {**db_defs, **root_defs}


# ─── Public API ───────────────────────────────────────────────────────────────

def validate_json_data(db: Session, schema: dict, data: dict):
    """
    Validates *data* against *schema*, fully resolving every $ref before
    handing the schema off to jsonschema so the validator never needs a
    custom resolver.  Supports:
      - in-document $defs  ("$ref": "#/$defs/goody")
      - cross-schema DB refs ("$ref": "goody")
    """
    try:
        defs = _build_defs(schema, db)
        inlined_schema = _inline_refs(schema, defs)
        jsonschema.validate(instance=data, schema=inlined_schema)
        return True, None
    except jsonschema.exceptions.ValidationError as e:
        return False, e.message
    except jsonschema.exceptions.SchemaError as e:
        return False, f"Invalid schema structure: {e.message}"
    except Exception as e:
        return False, str(e)
