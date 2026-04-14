figma.showUI(__html__, {
  width: 520,
  height: 660,
  title: 'Antares Token Exporter',
});

// ─── Message handler ───────────────────────────────────────────────────────────

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'READY':
      await sendCollections();
      break;

    case 'EXPORT': {
      const { collectionId, modeId } = msg;
      try {
        const json = await buildJson(collectionId, modeId);
        figma.ui.postMessage({ type: 'EXPORT_DATA', collectionId, modeId, json });
      } catch (err) {
        figma.ui.postMessage({ type: 'ERROR', message: err.message });
      }
      break;
    }

    case 'EXPORT_ALL': {
      try {
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const results = [];
        for (const collection of collections) {
          for (const mode of collection.modes) {
            const json = await buildJson(collection.id, mode.modeId);
            results.push({
              collectionId: collection.id,
              collectionName: collection.name,
              modeId: mode.modeId,
              modeName: mode.name,
              modeCount: collection.modes.length,
              json,
            });
          }
        }
        figma.ui.postMessage({ type: 'EXPORT_ALL_DATA', results });
      } catch (err) {
        figma.ui.postMessage({ type: 'ERROR', message: err.message });
      }
      break;
    }

    case 'CLOSE':
      figma.closePlugin();
      break;
  }
};

// ─── Collection list ────────────────────────────────────────────────────────────

async function sendCollections() {
  if (!figma.variables) {
    figma.ui.postMessage({
      type: 'ERROR',
      message: 'The Variables API is not available in this Figma version.',
    });
    return;
  }

  const collections = await figma.variables.getLocalVariableCollectionsAsync();

  if (collections.length === 0) {
    figma.ui.postMessage({ type: 'COLLECTIONS', data: [], fileName: figma.root.name });
    return;
  }

  const data = collections.map((col) => ({
    id: col.id,
    name: col.name,
    modes: col.modes, // Array<{ modeId: string, name: string }>
    variableCount: col.variableIds.length,
  }));

  figma.ui.postMessage({ type: 'COLLECTIONS', data, fileName: figma.root.name });
}

// ─── JSON builder ───────────────────────────────────────────────────────────────

async function buildJson(collectionId, modeId) {
  const allVariables = await figma.variables.getLocalVariablesAsync();

  // Build a lookup map: id → variable (needed to resolve alias references
  // that may point to variables in any collection)
  const variableMap = new Map(allVariables.map((v) => [v.id, v]));

  // Only process variables belonging to the requested collection
  const variables = allVariables.filter(
    (v) => v.variableCollectionId === collectionId
  );

  const result = {};

  for (const variable of variables) {
    // Split by "/" and strip whitespace, ignoring empty segments
    const path = variable.name
      .split('/')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (path.length === 0) continue;

    const rawValue = variable.valuesByMode[modeId];
    if (rawValue === undefined) continue;

    const $type = resolvedTypeToTokenType(variable.resolvedType);

    let $value;
    if (isVariableAlias(rawValue)) {
      // Alias → emit a {dot.separated.path} reference pointing to the
      // referenced variable's full name (with / → .)
      const refVar = variableMap.get(rawValue.id);
      $value = refVar
        ? `{${refVar.name.replace(/\//g, '.')}}`
        : `{unknown}`;
    } else {
      $value = formatValue(variable.resolvedType, rawValue);
    }

    setNestedValue(result, path, { $type, $value });
  }

  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Check whether a raw variable value is a VARIABLE_ALIAS object */
function isVariableAlias(raw) {
  return (
    raw !== null &&
    typeof raw === 'object' &&
    !('r' in raw) && // exclude COLOR objects { r, g, b, a }
    raw.type === 'VARIABLE_ALIAS'
  );
}

/** Map Figma resolvedType to W3C Design Token type string */
function resolvedTypeToTokenType(resolvedType) {
  const map = {
    COLOR: 'color',
    FLOAT: 'number',
    STRING: 'string',
    BOOLEAN: 'boolean',
  };
  return map[resolvedType] || 'unknown';
}

/**
 * Convert a raw Figma variable value to a JSON-serialisable primitive.
 * Colors are output as #RRGGBB (opaque) or rgba(r, g, b, a) (transparent).
 */
function formatValue(resolvedType, raw) {
  if (resolvedType === 'COLOR') {
    const r = Math.round(raw.r * 255);
    const g = Math.round(raw.g * 255);
    const b = Math.round(raw.b * 255);
    const a = raw.a;

    if (a < 1) {
      // Round alpha to 4 decimal places, matching the pattern in primitives.json
      return `rgba(${r}, ${g}, ${b}, ${parseFloat(a.toFixed(4))})`;
    }

    const hex = (n) => n.toString(16).padStart(2, '0').toUpperCase();
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }

  // FLOAT, STRING, BOOLEAN – return as-is
  return raw;
}

/**
 * Set a value at a nested path inside `obj`.
 *
 * If the target key already holds an object with children (because another
 * variable had a longer path through the same node), we MERGE the type/value
 * properties rather than replacing the object. This handles the pattern seen
 * in mode.light.json where a node like `color/bg/accent` has its own value
 * AND sub-keys like `color/bg/accent/bold`.
 */
function setNestedValue(obj, path, leafValue) {
  let cur = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];

    if (cur[key] === undefined || cur[key] === null) {
      cur[key] = {};
    } else if (typeof cur[key] !== 'object' || Array.isArray(cur[key])) {
      // Unexpected scalar at an intermediate node – wrap it
      cur[key] = {};
    }
    // Traverse even if the node already carries type/value (it can have both)
    cur = cur[key];
  }

  const last = path[path.length - 1];

  if (
    cur[last] !== undefined &&
    typeof cur[last] === 'object' &&
    !Array.isArray(cur[last])
  ) {
    // Node already exists with children → merge type/value in-place
    Object.assign(cur[last], leafValue);
  } else {
    cur[last] = leafValue;
  }
}
