import { NextResponse } from "next/server";

// GET /api/public/reviews — real Google reviews for the public site.
// Server-only: GOOGLE_PLACES_API_KEY must never reach the browser.
// Revalidated daily. Place Details calls that include `reviews` bill as
// Place Details Enterprise + Atmosphere, which has 1,000 free calls a month.
// Daily is ~30 calls a month plus one per build; hourly was ~720. This cache
// is a cost control: do not shorten it without checking the bill.
export const revalidate = 86400;

const MAX_QUOTE_CHARS = 320;

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
        return NextResponse.json({ available: false });
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
            return NextResponse.json({ available: false });
        }

        const data: PlacesResponse = await res.json();

        if (typeof data.rating !== "number" || typeof data.userRatingCount !== "number") {
            console.warn("[reviews] Places API response missing rating or userRatingCount");
            return NextResponse.json({ available: false });
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
        });
    } catch {
        console.warn("[reviews] Places API request failed");
        return NextResponse.json({ available: false });
    }
}
