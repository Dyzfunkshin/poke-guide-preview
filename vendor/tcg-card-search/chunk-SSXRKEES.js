// src/normalize.ts
function cleanName(name) {
  let s = String(name == null ? "" : name).trim();
  let prev;
  do {
    prev = s;
    s = s.replace(/\s*\[[^\]]*\]\s*$/, "").replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+-\s+[0-9A-Za-z]+(?:\/[0-9A-Za-z]+)?\s*$/, "").trim();
  } while (s !== prev && s);
  return s || String(name == null ? "" : name).trim();
}
function normName(name) {
  return cleanName(name).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");
}
function looseName(name) {
  return String(name == null ? "" : name).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");
}
function normPart(p) {
  return String(p == null ? "" : p).trim().toUpperCase().replace(/^([A-Z]*)0*(\d+)/, "$1$2");
}
function parseNumber(s) {
  const parts = String(s == null ? "" : s).trim().split("/");
  return {
    numerator: normPart(parts[0]),
    denominator: parts.length > 1 ? normPart(parts[1]) : ""
  };
}
function cardKey(name, numerator, denominator) {
  return normName(name) + "|" + normPart(numerator) + "|" + normPart(denominator);
}

// src/fields.ts
var ALL_FIELDS = [
  "name",
  "set",
  "number",
  "rarity",
  "game",
  "variant",
  "language",
  "productId",
  "printing",
  "artist",
  "supertype",
  "subtypes",
  "types",
  "natdex",
  "evolvesFrom",
  "playability",
  "format",
  // condition (2026-08-22): a HOLDINGS field, not a catalog one - the catalog
  // knows no Near Mint. Hosts indexing owned inventory supply it in FieldWords
  // ("near"/"mint"...); catalog indexes simply never carry the key, and a
  // missing key never matches, so catalog search is untouched.
  "condition"
];
var DEFAULT_FIELD_ORDER = [
  "number",
  "name",
  "set",
  "rarity",
  "printing",
  "variant",
  "artist",
  "supertype",
  "subtypes",
  "types",
  "natdex",
  "evolvesFrom",
  // Coarse filters: strong when queried explicitly, but they must never
  // outrank an identifying match like name/number/set.
  "format",
  "playability",
  "game",
  "language",
  "productId",
  // Weakest on purpose: a condition word must never outrank card identity.
  "condition"
];
function defaultFieldConfig() {
  return {
    enabled: new Set(ALL_FIELDS),
    order: [...DEFAULT_FIELD_ORDER]
  };
}
function enabledSet(config) {
  return config.enabled instanceof Set ? config.enabled : new Set(config.enabled);
}
function rankingOrder(config) {
  const enabled = enabledSet(config);
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const f of config.order) {
    if (enabled.has(f) && !seen.has(f)) {
      out.push(f);
      seen.add(f);
    }
  }
  for (const f of ALL_FIELDS) {
    if (enabled.has(f) && !seen.has(f)) {
      out.push(f);
      seen.add(f);
    }
  }
  return out;
}

// src/parse-query.ts
function normToken(token) {
  return token.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");
}
function splitQueryTokens(text) {
  return String(text == null ? "" : text).split(/[\s/]+/).map(normToken).filter(Boolean);
}
var FIELD_BY_TAG = new Map(
  ALL_FIELDS.map((field) => [field.toLowerCase(), field])
);
FIELD_BY_TAG.set("illustrator", "artist");
function parseTerms(raw) {
  const tokens = [];
  const terms = [];
  const unrecognized = [];
  let i = 0;
  const len = raw.length;
  while (i < len) {
    while (i < len && /[\s/]/.test(raw[i])) i++;
    if (i >= len) break;
    const wordStart = i;
    let tagEnd = -1;
    while (i < len && !/[\s/]/.test(raw[i])) {
      if (raw[i] === "[") {
        tagEnd = i;
        break;
      }
      i++;
    }
    if (tagEnd !== -1) {
      const bracketOpen = tagEnd;
      let bracketClose = raw.indexOf("]", bracketOpen + 1);
      if (bracketClose === -1) {
        i = bracketOpen + 1;
        const plainWord = raw.slice(wordStart, bracketOpen);
        const tok = normToken(plainWord);
        if (tok) {
          tokens.push(tok);
          terms.push({ value: tok, field: null });
        }
        const restStart = i;
        while (i < len && !/[\s/]/.test(raw[i]) && raw[i] !== "[") i++;
        const restWord = raw.slice(restStart, i);
        if (restWord) {
          const restTok = normToken(restWord);
          if (restTok) {
            tokens.push(restTok);
            terms.push({ value: restTok, field: null });
          }
        }
        continue;
      }
      const tag = raw.slice(wordStart, bracketOpen).toLowerCase();
      const valueRaw = raw.slice(bracketOpen + 1, bracketClose);
      i = bracketClose + 1;
      const recognizedField = FIELD_BY_TAG.get(tag);
      if (recognizedField) {
        const field = recognizedField;
        const valueTokens = valueRaw.split(/[\s]+/).map(normToken).filter(Boolean);
        for (const vt of valueTokens) {
          tokens.push(vt);
          terms.push({ value: vt, field });
        }
      } else {
        const normTag = normToken(tag);
        if (normTag && !unrecognized.includes(tag)) {
          unrecognized.push(tag);
        }
        if (normTag) {
          tokens.push(normTag);
          terms.push({ value: normTag, field: null });
        }
        const valueTokens = valueRaw.split(/[\s/]+/).map(normToken).filter(Boolean);
        for (const vt of valueTokens) {
          tokens.push(vt);
          terms.push({ value: vt, field: null });
        }
      }
    } else {
      const word = raw.slice(wordStart, i);
      const parts = word.split("/").map(normToken).filter(Boolean);
      for (const pt of parts) {
        tokens.push(pt);
        terms.push({ value: pt, field: null });
      }
    }
  }
  return { tokens, terms, unrecognizedFields: unrecognized };
}
function parseQuery(text) {
  const raw = String(text == null ? "" : text).trim();
  const { tokens, terms, unrecognizedFields } = parseTerms(raw);
  return { raw, tokens, terms, unrecognizedFields };
}
function normSet(name) {
  return String(name == null ? "" : name).replace(/^[A-Za-z]{1,4}\d{0,3}:\s*/, "").toLowerCase().replace(/&/g, " and ").replace(/\band\b/g, " ").replace(/(\S)\s+base set\s*$/, "$1").replace(/[^a-z0-9]+/g, "");
}
function nameWords(name) {
  return String(name == null ? "" : name).split(/\s+/).map(normName).filter(Boolean);
}

// src/index-matcher.ts
function buildIndex(records) {
  return records.map((r) => ({
    nn: looseName(r.displayName),
    fieldWords: r.fields,
    prod: r.prod,
    cardId: r.cardId
  }));
}
function fieldMatchKind(token, words) {
  let prefix = false;
  for (const w of words ?? []) {
    if (w === token) return "exact";
    if (w.startsWith(token)) prefix = true;
  }
  return prefix ? "prefix" : null;
}
function normNumberToken(token) {
  return normPart(token).toLowerCase();
}
function tokenMatchesAnyEnabledField(token, fieldWords, enabled) {
  for (const field of ALL_FIELDS) {
    if (!enabled.has(field)) continue;
    const effectiveToken = field === "number" ? normNumberToken(token) : token;
    if (fieldMatchKind(effectiveToken, fieldWords[field]) !== null) return true;
  }
  return false;
}
function taggedTermMatchesField(token, field, fieldWords, enabled) {
  if (!enabled.has(field)) return false;
  const effectiveToken = field === "number" ? normNumberToken(token) : token;
  return fieldMatchKind(effectiveToken, fieldWords[field]) !== null;
}
function entryMatches(entry, tokens, enabled) {
  for (const token of tokens) {
    if (!tokenMatchesAnyEnabledField(token, entry.fieldWords, enabled)) {
      return false;
    }
  }
  return true;
}
function entryMatchesTerms(entry, terms, enabled) {
  for (const term of terms) {
    if (term.field !== null) {
      if (!taggedTermMatchesField(term.value, term.field, entry.fieldWords, enabled)) {
        return false;
      }
    } else {
      if (!tokenMatchesAnyEnabledField(term.value, entry.fieldWords, enabled)) {
        return false;
      }
    }
  }
  return true;
}
var LinearMatcher = class {
  filter(index, query, config, topN) {
    const enabled = enabledSet(config);
    const terms = query.terms;
    const results = [];
    for (const entry of index) {
      if (results.length >= topN) break;
      if (terms.length === 0 || entryMatchesTerms(entry, terms, enabled)) {
        results.push(entry);
      }
    }
    return results;
  }
};
var IncrementalSearcher = class {
  constructor(index, matcher, defaultTopN = 50) {
    this.index = index;
    this.matcher = matcher;
    this.defaultTopN = defaultTopN;
  }
  /**
   * Run a fresh full-index scan for `query`. Always scans the complete index
   * regardless of prior call history, so as-you-type sequences (no reset
   * between keystrokes) never drop valid matches.
   */
  search(query, config, topN) {
    const limit = topN ?? this.defaultTopN;
    const fullMatches = this.matcher.filter(this.index, query, config, Infinity);
    return limit === Infinity ? fullMatches : fullMatches.slice(0, limit);
  }
  /** No-op retained for API compatibility. */
  reset() {
  }
};

// src/rank.ts
var KEY_EXACT_STRIDE = 2;
var KEY_EXACT_OFFSET = 0;
var KEY_PREFIX_OFFSET = 1;
var KEY_NO_MATCH = 65535;
var TIEBREAK_BASE = -50;
var TIEBREAK_HAS_SKUS = -25;
var TIEBREAK_HAS_IMAGE = -10;
var DEFAULT_NAME_CAP = 3;
var DEFAULT_LIMIT = 24;
function normNumberToken2(token) {
  return normPart(token).toLowerCase();
}
function explainMatch(entry, query, config) {
  const enabled = enabledSet(config);
  const order = rankingOrder(config);
  const terms = query.terms;
  return terms.map((term) => {
    const token = term.value;
    if (term.field !== null) {
      const field = term.field;
      if (enabled.has(field)) {
        const effectiveToken = field === "number" ? normNumberToken2(token) : token;
        const kind = fieldMatchKind(effectiveToken, entry.fieldWords[field]);
        if (kind !== null) {
          return { token, field, kind };
        }
      }
      return { token, field: null, kind: null };
    }
    for (const field of order) {
      if (!enabled.has(field)) continue;
      const effectiveToken = field === "number" ? normNumberToken2(token) : token;
      const kind = fieldMatchKind(effectiveToken, entry.fieldWords[field]);
      if (kind !== null) {
        return { token, field, kind };
      }
    }
    return { token, field: null, kind: null };
  });
}
function buildTokenKey(entry, query, config) {
  const order = rankingOrder(config);
  return query.terms.map((term) => {
    const token = term.value;
    if (term.field !== null) {
      const field = term.field;
      const rankIndex = order.indexOf(field);
      if (rankIndex === -1) return KEY_NO_MATCH;
      const effectiveToken = field === "number" ? normNumberToken2(token) : token;
      const kind = fieldMatchKind(effectiveToken, entry.fieldWords[field]);
      if (kind !== null) {
        const offset = kind === "exact" ? KEY_EXACT_OFFSET : KEY_PREFIX_OFFSET;
        return rankIndex * KEY_EXACT_STRIDE + offset;
      }
      return KEY_NO_MATCH;
    }
    for (let rankIndex = 0; rankIndex < order.length; rankIndex++) {
      const field = order[rankIndex];
      const effectiveToken = field === "number" ? normNumberToken2(token) : token;
      const kind = fieldMatchKind(effectiveToken, entry.fieldWords[field]);
      if (kind !== null) {
        const offset = kind === "exact" ? KEY_EXACT_OFFSET : KEY_PREFIX_OFFSET;
        return rankIndex * KEY_EXACT_STRIDE + offset;
      }
    }
    return KEY_NO_MATCH;
  });
}
function rank(entries, query, config, opts = {}) {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const nameCap = opts.nameCap ?? DEFAULT_NAME_CAP;
  const { isVariant, hasSkus, hasImage } = opts.accessors ?? {};
  const scored = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const tokenKey = buildTokenKey(entry, query, config);
    let tiebreak = 0;
    const prod = entry.prod;
    if (isVariant && !isVariant(prod)) tiebreak += TIEBREAK_BASE;
    if (hasSkus && hasSkus(prod)) tiebreak += TIEBREAK_HAS_SKUS;
    if (hasImage && hasImage(prod)) tiebreak += TIEBREAK_HAS_IMAGE;
    scored.push({ entry, tokenKey, tiebreak, inputIndex: i });
  }
  scored.sort((a, b) => {
    const len = Math.max(a.tokenKey.length, b.tokenKey.length);
    for (let i = 0; i < len; i++) {
      const ak = a.tokenKey[i] ?? KEY_NO_MATCH;
      const bk = b.tokenKey[i] ?? KEY_NO_MATCH;
      if (ak !== bk) return ak - bk;
    }
    return a.tiebreak - b.tiebreak || a.inputIndex - b.inputIndex;
  });
  const perName = {};
  const picked = [];
  const over = [];
  for (const hit of scored) {
    if (picked.length >= limit) break;
    const seen = perName[hit.entry.nn] ?? 0;
    if (seen >= nameCap) {
      over.push(hit);
      continue;
    }
    perName[hit.entry.nn] = seen + 1;
    picked.push(hit);
  }
  for (let i = 0; i < over.length && picked.length < limit; i++) {
    picked.push(over[i]);
  }
  return picked.map((h) => h.entry);
}

// src/engine.ts
var SearchEngine = class _SearchEngine {
  constructor(index, opts = {}) {
    const limit = opts.limit ?? 24;
    this.matcherCap = opts.matcherCap ?? limit * 10;
    this.fieldConfig = opts.fieldConfig ?? defaultFieldConfig();
    this.searcher = new IncrementalSearcher(
      index,
      new LinearMatcher(),
      this.matcherCap
    );
    this.rankOpts = {
      limit,
      nameCap: opts.nameCap ?? 3,
      accessors: opts.accessors
    };
  }
  /** Build directly from a flat RawRecord array (normalizes the index once). */
  static fromRawRecords(records, accessors, opts = {}) {
    const index = buildIndex(records);
    return new _SearchEngine(index, { ...opts, accessors });
  }
  /** The FieldConfig in effect (matching + ranking). */
  getFieldConfig() {
    return this.fieldConfig;
  }
  /**
   * Run a search and return ranked results.
   * Pipeline: parseQuery → IncrementalSearcher.search → rank.
   */
  query(text, opts) {
    const parsed = parseQuery(text);
    const matches = this.searcher.search(parsed, this.fieldConfig, this.matcherCap);
    const rankOpts = {
      ...this.rankOpts,
      ...opts?.limit !== void 0 && { limit: opts.limit },
      ...opts?.nameCap !== void 0 && { nameCap: opts.nameCap }
    };
    return rank(matches, parsed, this.fieldConfig, rankOpts);
  }
  /** Reset incremental narrowing state. */
  reset() {
    this.searcher.reset();
  }
};

// src/worker-protocol.ts
function createWorkerState() {
  return { engine: null };
}
function registerRankAccessors(state, accessors) {
  state.accessors = accessors;
}
function handleSearchMessage(state, msg) {
  if (msg.type === "init") {
    try {
      const opts = {
        limit: msg.opts?.limit,
        nameCap: msg.opts?.nameCap,
        fieldConfig: msg.opts?.fieldConfig
      };
      state.engine = SearchEngine.fromRawRecords(
        msg.records,
        state.accessors,
        opts
      );
      const response = { type: "ready" };
      return response;
    } catch (err) {
      const errorResponse = {
        type: "error",
        message: err instanceof Error ? err.message : String(err)
      };
      return errorResponse;
    }
  }
  if (msg.type === "query") {
    if (!state.engine) {
      const errorResponse = {
        type: "error",
        message: "SearchEngine not initialized. Send an 'init' message first."
      };
      return errorResponse;
    }
    try {
      const entries = state.engine.query(msg.text, {
        limit: msg.limit,
        nameCap: msg.nameCap
      });
      const response = {
        type: "results",
        seq: msg.seq,
        records: entries.map((e) => e.prod)
      };
      return response;
    } catch (err) {
      const errorResponse = {
        type: "error",
        message: err instanceof Error ? err.message : String(err)
      };
      return errorResponse;
    }
  }
  return null;
}

export {
  cleanName,
  normName,
  looseName,
  normPart,
  parseNumber,
  cardKey,
  ALL_FIELDS,
  DEFAULT_FIELD_ORDER,
  defaultFieldConfig,
  enabledSet,
  rankingOrder,
  splitQueryTokens,
  parseQuery,
  normSet,
  nameWords,
  buildIndex,
  fieldMatchKind,
  entryMatches,
  entryMatchesTerms,
  LinearMatcher,
  IncrementalSearcher,
  explainMatch,
  rank,
  SearchEngine,
  createWorkerState,
  registerRankAccessors,
  handleSearchMessage
};
//# sourceMappingURL=chunk-SSXRKEES.js.map