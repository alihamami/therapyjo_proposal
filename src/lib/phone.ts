/**
 * Jordanian phone numbers get typed in a dozen shapes depending on who is
 * entering them and what they copy from — a WhatsApp contact card, a paper
 * intake form, a number read aloud over the phone. "0790022404",
 * "+962 7 9101 0021", "962790022404" and "790022404" are frequently the
 * SAME number. Comparing the raw strings (what the old duplicate-detection
 * code did) misses nearly all of that, because none of those strings are
 * equal to each other even though a human reads them as the same digits.
 *
 * normalizePhone() collapses all of these into one canonical key so two
 * differently-typed copies of the same number compare equal. It intentionally
 * throws away everything that isn't information about WHICH number this is
 * (formatting, the country code when it's the local default, the domestic
 * trunk zero) and keeps only the digits that actually distinguish one
 * subscriber from another.
 */

// A leading "0" (the domestic trunk prefix) or a leading "962" (Jordan's
// country code, optionally followed by that same trunk zero — some people
// type both) is not part of the subscriber's identity. Stripping it, then
// checking what's left against the two shapes Jordanian numbers come in
// (7-prefixed 9-digit mobiles, 6-prefixed 8-digit landlines), is what lets
// "0790022404", "+962790022404" and "790022404" all collapse to "790022404".
const JORDAN_MOBILE = /^7\d{8}$/;
const JORDAN_LANDLINE = /^6\d{7}$/;

/**
 * Canonical comparison key for a phone number. Two numbers are "the same"
 * for duplicate-detection purposes exactly when this returns the same,
 * non-empty string for both.
 *
 * Not a validator — a number that doesn't match a recognised Jordanian
 * shape still gets a (best-effort) key, because two identical foreign
 * numbers should still group with each other even though we can't reason
 * about their internal structure. What we refuse to key is anything too
 * short to mean anything: fewer than 6 digits comes back as "", and callers
 * MUST treat "" as "no identity" rather than a valid group key — grouping
 * on it would silently merge every patient with a blank/garbage phone
 * field into one giant false-positive "duplicate".
 */
export function normalizePhone(raw: string | null | undefined): string {
    if (!raw) return "";

    let digits = String(raw).replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2); // international dialing prefix

    if (digits.length < 6) return "";

    // Peel off a country code and/or trunk zero to get the "national number".
    let national = digits;
    if (national.startsWith("962")) {
        national = national.slice(3);
        if (national.startsWith("0")) national = national.slice(1); // "9620…" typed with the trunk zero too
    } else if (national.startsWith("0")) {
        national = national.slice(1);
    }

    if (JORDAN_MOBILE.test(national) || JORDAN_LANDLINE.test(national)) {
        return national;
    }

    // Doesn't match a recognised Jordanian shape (wrong length, foreign
    // number, garbage). Return the digits as typed (post international-prefix
    // strip) rather than the guessed-at national number — an unrecognised
    // shape means our country-code/trunk-zero guess isn't trustworthy, but
    // the same raw input will still always produce the same key, so two
    // identical foreign numbers still group.
    return digits;
}

/**
 * Convenience wrapper: do these two raw values refer to the same phone
 * number once normalized? Two unusable ("") numbers are never "the same" —
 * see normalizePhone's note on empty keys.
 */
export function samePhone(
    a: string | null | undefined,
    b: string | null | undefined
): boolean {
    const ka = normalizePhone(a);
    return ka !== "" && ka === normalizePhone(b);
}

/**
 * The deduplicated, non-empty normalized keys for one patient's phone
 * fields. A patient can carry two keys (phone1 and phone2 normalize
 * differently), which is why grouping duplicates has to key on every entry
 * in this array rather than on a single field — otherwise a duplicate
 * hiding in phone2 is invisible.
 */
export function phoneKeys(p: { phone1: string; phone2?: string | null }): string[] {
    const keys = new Set<string>();
    const k1 = normalizePhone(p.phone1);
    const k2 = normalizePhone(p.phone2);
    if (k1) keys.add(k1);
    if (k2) keys.add(k2);
    return Array.from(keys);
}

// ─── Name matching (confidence signal only — see nameSimilarity) ─────────

// U+064B–U+0652: tashkeel (short vowel marks). U+0640: tatweel (elongation
// stroke). Neither carries information about which letters make up the
// name, only how it's typeset, so both are dropped before comparison.
const ARABIC_DIACRITICS_AND_TATWEEL = /[ً-ْـ]/g;

/**
 * Fold spelling variation out of a name so "ali hamami" and "Ali  Hamami."
 * compare equal, and so the Arabic letter variants that are really the same
 * letter (أ إ آ ٱ all render as alef; ى is a yeh-shaped alef; etc.) stop
 * being different letters for comparison purposes. This does NOT drop
 * name-connector words (al/abu/bin/…) — that happens one level up, in
 * nameSimilarity, because normalizeName is a general "same text, different
 * spelling" fold, not a name-matching heuristic on its own.
 */
export function normalizeName(name: string): string {
    if (!name) return "";
    let s = name
        .replace(ARABIC_DIACRITICS_AND_TATWEEL, "")
        .replace(/[آأإٱ]/g, "ا") // آ أ إ ٱ -> ا
        .replace(/ة/g, "ه") // ة -> ه
        .replace(/ى/g, "ي") // ى -> ي
        .replace(/ؤ/g, "و") // ؤ -> و
        .replace(/ئ/g, "ي"); // ئ -> ي
    s = s.toLowerCase();
    s = s.replace(/[^\p{L}\p{N}\s]/gu, " "); // punctuation -> space (not deleted), so word boundaries survive
    return s.trim().replace(/\s+/g, " ");
}

// Tokens that mean "connector", not "identity" — the reason "ali hamami"
// and "ali al hamami" are the same person spelled two ways. Dropping them
// before comparing tokens is what makes that pair score as a match instead
// of two unrelated-looking strings.
const CONNECTOR_TOKENS = new Set([
    "al", "el", "ال",
    "abu", "abo", "ابو",
    "bin", "ben", "bint",
    "haj", "hajj", "الحاج",
    "abd", "abdel",
]);

// In Arabic the definite article is written JOINED to the following word —
// "الحمامي" (al-Hamami), not "ال حمامي" as two tokens — so the standalone
// CONNECTOR_TOKENS entry for "ال" only ever matches the transliterated
// Latin form ("ali al hamami"), never how Arabic script actually spells it.
// Without this, "علي الحمامي" and "علي حمامي" tokenize to disjoint-looking
// sets ({علي, الحمامي} vs {علي, حمامي}) and score as barely related instead
// of the same connector divergence the Latin case already handles.
//
// Guarded to only strip when at least 3 characters remain, so a name that
// merely STARTS with the same two letters — "الياس" (Elias) — isn't
// mangled into a shorter, different-looking token by a rule meant for
// grammatical prefixes, not name roots.
function stripAttachedDefiniteArticle(token: string): string {
    if (token.startsWith("ال") && token.length - 2 >= 3) {
        return token.slice(2);
    }
    return token;
}

// "عبد" ("servant of") prefixes a large share of Arabic male
// names (عبدالله, عبدالرحمن, عبدالعزيز, ...), and staff type the compound joined or
// split about equally often. Unlike the definite article, this isn’t a
// per-token strip — "عبد" split from its own name is a separate token, so the
// joined and split forms tokenize to different-SIZED sets no amount of
// dropping can reconcile. Instead, glue a standalone "عبد" onto the token
// that follows it before anything else runs, so "عبد الرحمن" (split) becomes
// one token identical to the joined form's own "عبدالرحمن" — which then goes
// through the same definite-article strip as any other token. A trailing
// "عبد" with nothing after it (no next token to glue to) is left as-is.
function mergeStandaloneAbdPrefix(tokens: string[]): string[] {
    const out: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === "عبد" && i + 1 < tokens.length) {
            out.push(tokens[i] + tokens[i + 1]);
            i++; // the next token was consumed into the merge above
        } else {
            out.push(tokens[i]);
        }
    }
    return out;
}

function nameTokens(normalized: string): string[] {
    const raw = normalized.split(" ").filter(Boolean);
    return mergeStandaloneAbdPrefix(raw)
        .filter((t) => !CONNECTOR_TOKENS.has(t))
        .map(stripAttachedDefiniteArticle);
}

/**
 * How alike two names are, from 0 (nothing in common) to 1 (the same name).
 * This is a CONFIDENCE SIGNAL for staff reviewing a phone-matched group —
 * never a filter. The owner was explicit that the phone number is the
 * ground truth ("phone numbers are always the same"); a low name score next
 * to a phone match still means "same patient, misspelled or reordered
 * name", not "not a duplicate". Callers must never use this to drop or
 * split a phone-matched group — only to decide how loudly to flag it.
 */
export function nameSimilarity(a: string, b: string): number {
    const na = normalizeName(a);
    const nb = normalizeName(b);
    if (na === nb) return 1;

    const ta = new Set(nameTokens(na));
    const tb = new Set(nameTokens(nb));

    if (ta.size === 0 && tb.size === 0) return 1;
    if (ta.size === 0 || tb.size === 0) return 0;

    let intersection = 0;
    for (const t of ta) {
        if (tb.has(t)) intersection++;
    }
    const union = ta.size + tb.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

/**
 * True when a stored phone holds no number at all: empty, whitespace, or
 * only zeros ("0", "00"). Some patients are saved that way, and the screens
 * printed it as if it were a number. Display-only; the stored value is never
 * changed. (TJ-068d)
 */
export function isMissingPhone(raw: string | null | undefined): boolean {
    const t = (raw ?? "").trim();
    return t === "" || /^0+$/.test(t);
}

/** A patient's numbers for a list cell, missing ones skipped; null when none is left. (TJ-068d) */
export function joinPhones(...raws: (string | null | undefined)[]): string | null {
    const shown = raws.filter((r) => !isMissingPhone(r)).map((r) => (r as string).trim());
    return shown.length ? shown.join(" / ") : null;
}
