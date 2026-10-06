import {
  ALL_FIELDS,
  DEFAULT_FIELD_ORDER,
  IncrementalSearcher,
  LinearMatcher,
  SearchEngine,
  buildIndex,
  cardKey,
  cleanName,
  createWorkerState,
  defaultFieldConfig,
  enabledSet,
  entryMatches,
  entryMatchesTerms,
  explainMatch,
  fieldMatchKind,
  handleSearchMessage,
  looseName,
  nameWords,
  normName,
  normPart,
  normSet,
  parseNumber,
  parseQuery,
  rank,
  rankingOrder,
  registerRankAccessors,
  splitQueryTokens
} from "./chunk-SSXRKEES.js";

// src/catalog-adapter.ts
var GRADES = [
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
  "Unopened"
];
var PRINTING_ORDER = [
  "Normal",
  "Holofoil",
  "Reverse Holofoil",
  "1st Edition",
  "1st Edition Holofoil",
  "Unlimited",
  "Unlimited Holofoil"
];
function toWords(text) {
  return String(text == null ? "" : text).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
}
function displayName(product) {
  if (!product) return "";
  return product.n + (product.q ? " (" + product.q + ")" : "");
}
function setNumberKey(set, num) {
  const setPart = String(set ?? "").trim().toLowerCase();
  const numPart = String(num ?? "").trim().toLowerCase();
  return setPart && numPart ? setPart + "|" + numPart : "";
}
function cardIdOf(product) {
  return product.p != null ? "tcgp-" + String(product.p) : null;
}
function printingOfCondition(label, grade) {
  if (label === grade) return "Normal";
  const suffix = label.slice(grade.length).trim();
  return suffix || "Normal";
}
function printingsOf(product, conditions) {
  if (!product || !product.k) return ["Normal"];
  const seen = {};
  for (const idx of Object.keys(product.k)) {
    const label = conditions[Number(idx)] ?? "";
    const grade = GRADES.find((g) => label.indexOf(g) === 0) ?? "";
    const printing = printingOfCondition(label, grade) || "Normal";
    seen[printing] = true;
  }
  const out = PRINTING_ORDER.filter((p) => seen[p]);
  for (const p of Object.keys(seen)) {
    if (!out.includes(p)) out.push(p);
  }
  return out.length ? out : ["Normal"];
}
var EN_WORDS = ["en", "eng", "english"];
var JP_WORDS = ["jp", "jap", "ja", "japanese"];
var LANGUAGE_ALIASES = {
  en: EN_WORDS,
  eng: EN_WORDS,
  english: EN_WORDS,
  jp: JP_WORDS,
  ja: JP_WORDS,
  jap: JP_WORDS,
  japanese: JP_WORDS
};
function languageWords(product, lang) {
  const stated = toWords(lang);
  if (stated.length) {
    const alias = LANGUAGE_ALIASES[stated[0]];
    return alias ? [...alias] : stated;
  }
  return product.jp ? [...JP_WORDS] : [...EN_WORDS];
}
function playabilityWords(product) {
  return product.play == null ? [] : ["playable", "played"];
}
var FORMAT_SYNONYMS = {
  std: ["std", "standard"],
  exp: ["exp", "expanded"],
  unl: ["unl", "unlimited"]
};
function formatWords(product) {
  const out = /* @__PURE__ */ new Set();
  for (const [format, legal] of Object.entries(product.fmt ?? {})) {
    if (!legal) continue;
    for (const word of FORMAT_SYNONYMS[format] ?? toWords(format)) out.add(word);
  }
  return [...out];
}
function numberWords(product) {
  const { numerator, denominator } = parseNumber(product.num);
  const out = [];
  if (numerator) out.push(numerator.toLowerCase());
  if (denominator) out.push(denominator.toLowerCase());
  return out;
}
function printingWords(product, conditions, stated = []) {
  const seen = /* @__PURE__ */ new Set();
  const sources = stated.length ? stated : printingsOf(product, conditions);
  for (const printing of sources) {
    for (const w of toWords(printing)) seen.add(w);
  }
  if (seen.has("holofoil")) seen.add("holo");
  if (seen.has("1st")) seen.add("first");
  return [...seen];
}
function buildFieldWords(product, conditions, identities = []) {
  const productIdWords = product.p != null ? [String(product.p)] : [];
  const metadataWords = (select) => [...new Set(identities.flatMap((identity) => toWords(select(identity))))];
  const firstOf = (select) => {
    for (const identity of identities) {
      const value = select(identity);
      if (value) return String(value);
    }
    return "";
  };
  const words = {
    name: toWords(product.n),
    set: toWords(product.s),
    number: numberWords(product),
    rarity: toWords(product.r),
    game: toWords(product.g),
    variant: toWords(product.q),
    language: languageWords(product, firstOf((identity) => identity.lang)),
    productId: productIdWords,
    printing: printingWords(
      product,
      conditions,
      identities.map((identity) => identity.printing ?? "").filter(Boolean)
    ),
    artist: metadataWords((identity) => identity.artist),
    // Carried on the product too, so supertype search works even when the
    // caller passes no identities at all.
    supertype: [
      .../* @__PURE__ */ new Set([
        ...toWords(product.supertype),
        ...metadataWords((identity) => identity.supertype)
      ])
    ],
    subtypes: metadataWords((identity) => identity.subtypes?.join(" ")),
    types: metadataWords((identity) => identity.types?.join(" ")),
    natdex: metadataWords((identity) => identity.natdex?.join(" ")),
    evolvesFrom: metadataWords((identity) => identity.evolvesFrom),
    playability: playabilityWords(product),
    format: formatWords(product),
    // The catalog knows no condition; the empty list never matches, which is
    // exactly right — condition is a HOLDINGS field, supplied by inventory hosts.
    condition: []
  };
  return words;
}
function toRawRecords(artifact, identities = []) {
  const records = [];
  const conditions = artifact.conditions ?? [];
  const byKey = artifact.byKey;
  const identitiesByProductId = /* @__PURE__ */ new Map();
  const identitiesBySetNumber = /* @__PURE__ */ new Map();
  for (const identity of identities) {
    if (identity.p != null) {
      const matches2 = identitiesByProductId.get(identity.p) ?? [];
      matches2.push(identity);
      identitiesByProductId.set(identity.p, matches2);
      continue;
    }
    const key = setNumberKey(identity.set, identity.num);
    if (!key) continue;
    const matches = identitiesBySetNumber.get(key) ?? [];
    matches.push(identity);
    identitiesBySetNumber.set(key, matches);
  }
  for (const key in byKey) {
    for (const prod of byKey[key]) {
      let matched = prod.p == null ? [] : identitiesByProductId.get(prod.p) ?? [];
      if (!matched.length) {
        matched = identitiesBySetNumber.get(setNumberKey(prod.s, prod.num)) ?? [];
      }
      records.push({
        displayName: displayName(prod),
        fields: buildFieldWords(prod, conditions, matched),
        prod,
        cardId: cardIdOf(prod)
      });
    }
  }
  return records;
}
var catalogRankAccessors = {
  isVariant: (p) => Boolean(p.v),
  hasSkus: (p) => Object.keys(p.k ?? {}).length > 0,
  hasImage: (p) => Boolean(p.i)
};
function skuIdFor(product, conditions, grade = "Near Mint", printing) {
  if (!product || !product.k) return null;
  const condIndex = {};
  conditions.forEach((c, i) => {
    condIndex[c] = i;
  });
  const g = grade || "Near Mint";
  let order;
  if (printing != null) {
    const want = printing ? g + " " + printing : g;
    order = [
      want,
      g,
      g + " Holofoil",
      g + " Reverse Holofoil",
      g + " 1st Edition Holofoil",
      g + " 1st Edition",
      g + " Unlimited Holofoil",
      g + " Unlimited"
    ];
  } else {
    order = [
      g,
      g + " Holofoil",
      g + " Reverse Holofoil",
      g + " Unlimited",
      g + " Unlimited Holofoil",
      g + " 1st Edition"
    ];
  }
  for (const condLabel of order) {
    const idx = condIndex[condLabel];
    if (idx != null && product.k[idx] != null) {
      const skuRaw2 = product.k[idx];
      if (skuRaw2 == null) continue;
      return {
        id: skuRaw2,
        condition: condLabel,
        printing: printingOfCondition(condLabel, g)
      };
    }
  }
  const keys = Object.keys(product.k);
  if (!keys.length) return null;
  const label = conditions[Number(keys[0])] ?? "";
  const gradeOnly = label.replace(/\s+(Holofoil|Reverse Holofoil|1st Edition.*|Unlimited.*)/i, "").trim() || g;
  const skuRaw = product.k[keys[0]];
  if (skuRaw == null) return null;
  return {
    id: skuRaw,
    condition: label,
    printing: printingOfCondition(label, gradeOnly)
  };
}
function buildProductIdMap(artifact) {
  const map = {};
  for (const key in artifact.byKey) {
    for (const prod of artifact.byKey[key]) {
      if (prod.p != null) {
        map[prod.p] = prod;
      }
    }
  }
  return map;
}

// src/worker-client.ts
var SearchWorkerClient = class {
  constructor(worker) {
    this.seq = 0;
    /** Pending query resolvers, keyed by seq. */
    this.pending = /* @__PURE__ */ new Map();
    /** Promise that resolves once 'ready' is received after init. */
    this.readyResolve = null;
    this.readyReject = null;
    this.worker = worker;
    worker.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    worker.onerror = (event) => {
      const err = new Error(event.message ?? "Worker error");
      this.rejectAll(err);
      if (this.readyReject) {
        this.readyReject(err);
        this.readyResolve = null;
        this.readyReject = null;
      }
    };
  }
  /**
   * Send raw records to the worker and wait for the index to be built.
   *
   * Resolves when the worker responds with `{ type: 'ready' }`.
   * Rejects on worker error.
   *
   * @param records  Flat raw records (from toRawRecords() or a fixture).
   * @param opts     Optional engine options (limit, nameCap).
   */
  init(records, opts) {
    return new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
      this.worker.postMessage({ type: "init", records, opts });
    });
  }
  /**
   * Run a ranked search query.
   *
   * Each call supersedes all previous pending queries. Stale results (seq
   * lower than the latest) are discarded and their Promises are rejected with
   * `StaleQueryError`.
   *
   * @param text  Raw user input (e.g. "char", "pikachu OBF 25").
   * @returns     Promise resolving to ranked product records (P[]).
   */
  query(text, opts) {
    const seq = ++this.seq;
    this.pending.forEach((entry, pendingSeq) => {
      if (pendingSeq < seq) {
        entry.reject(new StaleQueryError(pendingSeq, seq));
        this.pending.delete(pendingSeq);
      }
    });
    return new Promise((resolve, reject) => {
      this.pending.set(seq, { resolve, reject });
      this.worker.postMessage({
        type: "query",
        text,
        seq,
        limit: opts?.limit,
        nameCap: opts?.nameCap
      });
    });
  }
  /** Terminate the underlying Worker and reject all pending queries. */
  terminate() {
    this.rejectAll(new Error("Worker terminated"));
    this.worker.terminate();
  }
  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------
  handleMessage(msg) {
    if (msg.type === "ready") {
      if (this.readyResolve) {
        this.readyResolve();
        this.readyResolve = null;
        this.readyReject = null;
      }
      return;
    }
    if (msg.type === "results") {
      const resultsMsg = msg;
      const { seq, records } = resultsMsg;
      if (seq < this.seq) {
        const entry2 = this.pending.get(seq);
        if (entry2) {
          entry2.reject(new StaleQueryError(seq, this.seq));
          this.pending.delete(seq);
        }
        return;
      }
      const entry = this.pending.get(seq);
      if (entry) {
        entry.resolve(records);
        this.pending.delete(seq);
      }
      return;
    }
    if (msg.type === "error") {
      const err = new Error(msg.message);
      this.rejectAll(err);
      if (this.readyReject) {
        this.readyReject(err);
        this.readyResolve = null;
        this.readyReject = null;
      }
    }
  }
  rejectAll(err) {
    this.pending.forEach((entry) => entry.reject(err));
    this.pending.clear();
  }
};
var StaleQueryError = class extends Error {
  constructor(staleSeq, latestSeq) {
    super(
      `Query seq ${staleSeq} is stale (latest seq is ${latestSeq})`
    );
    this.name = "StaleQueryError";
    this.staleSeq = staleSeq;
    this.latestSeq = latestSeq;
  }
};

// src/index.ts
var VERSION = "0.1.0";
export {
  ALL_FIELDS,
  DEFAULT_FIELD_ORDER,
  IncrementalSearcher,
  LinearMatcher,
  SearchEngine,
  SearchWorkerClient,
  StaleQueryError,
  VERSION,
  buildFieldWords,
  buildIndex,
  buildProductIdMap,
  cardIdOf,
  cardKey,
  catalogRankAccessors,
  cleanName,
  createWorkerState,
  defaultFieldConfig,
  displayName,
  enabledSet,
  entryMatches,
  entryMatchesTerms,
  explainMatch,
  fieldMatchKind,
  handleSearchMessage,
  looseName,
  nameWords,
  normName,
  normPart,
  normSet,
  parseNumber,
  parseQuery,
  printingsOf,
  rank,
  rankingOrder,
  registerRankAccessors,
  skuIdFor,
  splitQueryTokens,
  toRawRecords,
  toWords
};
//# sourceMappingURL=index.js.map