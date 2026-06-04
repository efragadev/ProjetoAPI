const RAWG_API_BASE = "https://api.rawg.io/api";

async function searchGames({ search, pageSize }) {
    const rawgUrl = createRawgUrl("/games");

    rawgUrl.searchParams.set("search", search);
    rawgUrl.searchParams.set("page_size", String(pageSize));

    const payload = await fetchRawg(rawgUrl, "Nao foi possivel buscar jogos na RAWG.");

    return {
        count: payload.count,
        results: (payload.results || []).map(toPublicGame),
    };
}

async function getTrendingGames({ pageSize }) {
    const { from, to } = getRecentDateRange();
    const rawgUrl = createRawgUrl("/games");

    rawgUrl.searchParams.set("dates", `${from},${to}`);
    rawgUrl.searchParams.set("ordering", "-added");
    rawgUrl.searchParams.set("page_size", String(pageSize));

    const payload = await fetchRawg(rawgUrl, "Nao foi possivel buscar jogos em alta na RAWG.");

    return {
        count: payload.count,
        results: (payload.results || [])
            .map(toPublicGame)
            .filter((game) => game.background_image),
    };
}

function createRawgUrl(pathname) {
    const apiKey = process.env.RAWG_API_KEY;

    if (!apiKey) {
        const error = new Error("RAWG_API_KEY nao configurada no servidor.");
        error.status = 500;
        throw error;
    }

    const url = new URL(`${RAWG_API_BASE}${pathname}`);
    url.searchParams.set("key", apiKey);

    return url;
}

async function fetchRawg(url, fallbackMessage) {
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": "efraga-games/1.0",
        },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(fallbackMessage);
        error.status = response.status;
        error.details = payload?.detail;
        throw error;
    }

    return payload;
}

function toPublicGame(game) {
    return {
        id: game.id,
        name: game.name,
        background_image: normalizeImageUrl(game.background_image),
        rating: game.rating,
        released: game.released,
        genres: (game.genres || []).map((genre) => genre.name),
        platforms: (game.platforms || []).map((entry) => entry.platform?.name).filter(Boolean),
    };
}

function normalizeImageUrl(value) {
    if (typeof value !== "string") {
        return "";
    }

    try {
        const url = new URL(value);

        if (url.protocol !== "https:" && url.protocol !== "http:") {
            return "";
        }

        return url.href;
    } catch {
        return "";
    }
}

function getRecentDateRange() {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 120);

    return {
        from: toRawgDate(startDate),
        to: toRawgDate(today),
    };
}

function toRawgDate(date) {
    return date.toISOString().slice(0, 10);
}

module.exports = {
    getTrendingGames,
    searchGames,
};
