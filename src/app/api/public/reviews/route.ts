import { NextResponse } from "next/server";

// GET /api/public/reviews — real Google reviews for the public site.
// Server-only: GOOGLE_PLACES_API_KEY must never reach the browser.
// Place Details calls that include `reviews` bill as Place Details
// Enterprise + Atmosphere, which has 1,000 free calls a month. The cost
// control is the fetch below: Next's data cache keeps a successful answer for
// a day, so about 30 calls a month; hourly was ~720. Do not shorten it without
// checking the bill, and raise the Console's daily cap rather than this.
//
// The route itself is dynamic, never prerendered (TJ-076). A build no longer
// calls Places: every build, local ones included, used to spend one of the 30
// calls a day. And a failure is no longer frozen for a day: Next's data cache
// keeps only status-200 answers, so after a failure the next visit asks again.
// The edge keeps a failure for 10 minutes, so an outage costs a few calls an
// hour rather than one per visit, and keeps a success for an hour.
export const dynamic = "force-dynamic";

const MAX_QUOTE_CHARS = 320;

// What the edge may keep (see the note at the top).
const FAILURE_CACHE = "public, s-maxage=600";
const SUCCESS_CACHE = "public, s-maxage=3600";

function unavailable() {
    return NextResponse.json({ available: false }, { headers: { "Cache-Control": FAILURE_CACHE } });
}

interface LocalizedText {
    text?: string;
    languageCode?: string;
}

interface PlacesReview {
    name?: string;
    rating?: number;
    text?: LocalizedText;
    originalText?: LocalizedText;
    relativePublishTimeDescription?: string;
    googleMapsUri?: string;
    authorAttribution?: { displayName?: string };
}

interface PlacesResponse {
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
    reviews?: PlacesReview[];
}

function truncate(text: string): { text: string; truncated: boolean } {
    if (text.length <= MAX_QUOTE_CHARS) return { text, truncated: false };
    const cut = text.slice(0, MAX_QUOTE_CHARS);
    const lastSpace = cut.lastIndexOf(" ");
    const body = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
    return { text: `${body}…`, truncated: true };
}

export async function GET() {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    const placeId = process.env.GOOGLE_PLACES_PLACE_ID;

    if (!key || !placeId) {
        console.warn("[reviews] GOOGLE_PLACES_API_KEY or GOOGLE_PLACES_PLACE_ID is not set");
        return unavailable();
    }

    try {
        const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
            headers: {
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews",
            },
            next: { revalidate: 86400 },
        });

        if (!res.ok) {
            console.warn(`[reviews] Places API returned ${res.status}`);
            return unavailable();
        }

        const data: PlacesResponse = await res.json();

        if (typeof data.rating !== "number" || typeof data.userRatingCount !== "number") {
            console.warn("[reviews] Places API response missing rating or userRatingCount");
            return unavailable();
        }

        const reviews = (data.reviews ?? []).flatMap((r) => {
            // Show the review as its author wrote it. Google omits originalText
            // when nothing was translated, so the fallback carries real weight.
            const source = r.originalText?.text ?? r.text?.text ?? "";
            const author = r.authorAttribution?.displayName?.trim() ?? "";
            if (!source || !author) return [];
            const { text, truncated } = truncate(source);
            return [{
                id: r.name ?? `${author}-${r.relativePublishTimeDescription ?? ""}`,
                author,
                rating: typeof r.rating === "number" ? r.rating : 5,
                text,
                truncated,
                relativeTime: r.relativePublishTimeDescription ?? "",
                url: r.googleMapsUri ?? data.googleMapsUri ?? "",
            }];
        });

        return NextResponse.json({
            available: true,
            rating: data.rating,
            userRatingCount: data.userRatingCount,
            googleMapsUri: data.googleMapsUri ?? "",
            reviews,
        }, { headers: { "Cache-Control": SUCCESS_CACHE } });
    } catch {
        console.warn("[reviews] Places API request failed");
        return unavailable();
    }
}
