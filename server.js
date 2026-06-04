const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const RAWG_API_BASE = "https://api.rawg.io/api";
const PUBLIC_DIR = __dirname;

loadEnvFile();

const mimeTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
};

const server = http.createServer(async (req, res) => {
    try {
        const requestUrl = new URL(req.url, `http://${req.headers.host}`);

        if (requestUrl.pathname === "/api/games") {
            await handleGamesSearch(requestUrl, res);
            return;
        }

        serveStaticFile(requestUrl.pathname, res);
    } catch (error) {
        console.error(error);
        sendJson(res, 500, { error: "Erro interno no servidor." });
    }
});

server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});

async function handleGamesSearch(requestUrl, res) {
    const apiKey = process.env.RAWG_API_KEY;

    if (!apiKey) {
        sendJson(res, 500, {
            error: "RAWG_API_KEY nao configurada no servidor.",
        });
        return;
    }

    const search = normalizeSearch(requestUrl.searchParams.get("search"));
    const pageSize = normalizePageSize(requestUrl.searchParams.get("page_size"));

    if (!search) {
        sendJson(res, 400, { error: "Informe o nome de um jogo para buscar." });
        return;
    }

    const rawgUrl = new URL(`${RAWG_API_BASE}/games`);
    rawgUrl.searchParams.set("key", apiKey);
    rawgUrl.searchParams.set("search", search);
    rawgUrl.searchParams.set("page_size", String(pageSize));

    const rawgResponse = await fetch(rawgUrl, {
        headers: {
            Accept: "application/json",
            "User-Agent": "efraga-games/1.0",
        },
    });

    const rawgPayload = await rawgResponse.json().catch(() => ({}));

    if (!rawgResponse.ok) {
        sendJson(res, rawgResponse.status, {
            error: "Nao foi possivel buscar jogos na RAWG.",
            details: rawgPayload?.detail,
        });
        return;
    }

    sendJson(res, 200, {
        count: rawgPayload.count,
        results: (rawgPayload.results || []).map(toPublicGame),
    });
}

function toPublicGame(game) {
    return {
        id: game.id,
        name: game.name,
        background_image: game.background_image,
        rating: game.rating,
        released: game.released,
        genres: (game.genres || []).map((genre) => genre.name),
        platforms: (game.platforms || []).map((entry) => entry.platform?.name).filter(Boolean),
    };
}

function serveStaticFile(pathname, res) {
    const safePath = pathname === "/" ? "/index.html" : pathname;
    const filePath = path.normalize(path.join(PUBLIC_DIR, `.${safePath}`));
    const relativePath = path.relative(PUBLIC_DIR, filePath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath) || hasHiddenSegment(relativePath)) {
        sendText(res, 403, "Acesso negado.");
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            sendText(res, 404, "Arquivo nao encontrado.");
            return;
        }

        const ext = path.extname(filePath);
        res.writeHead(200, {
            "Content-Type": mimeTypes[ext] || "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
        });
        res.end(content);
    });
}

function hasHiddenSegment(filePath) {
    return filePath.split(path.sep).some((segment) => segment.startsWith("."));
}

function normalizeSearch(value) {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim().slice(0, 80);
}

function normalizePageSize(value) {
    const pageSize = Number(value || 12);

    if (!Number.isInteger(pageSize)) {
        return 12;
    }

    return Math.min(Math.max(pageSize, 1), 20);
}

function sendJson(res, status, payload) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(payload));
}

function sendText(res, status, message) {
    res.writeHead(status, {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
    });
    res.end(message);
}

function loadEnvFile() {
    const envPath = path.join(__dirname, ".env");

    if (!fs.existsSync(envPath)) {
        return;
    }

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith("#")) {
            continue;
        }

        const separatorIndex = trimmedLine.indexOf("=");

        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmedLine.slice(0, separatorIndex).trim();
        const value = trimmedLine.slice(separatorIndex + 1).trim();

        if (key && !process.env[key]) {
            process.env[key] = value.replace(/^["']|["']$/g, "");
        }
    }
}
