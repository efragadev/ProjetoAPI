const express = require("express");
const path = require("node:path");
const { loadEnvFile } = require("./env");
const { getTrendingGames, searchGames } = require("./rawg");

loadEnvFile();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_DIR = path.join(__dirname, "..");

app.disable("x-powered-by");

app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
});

app.get("/api/games", async (req, res, next) => {
    try {
        const search = normalizeSearch(req.query.search);

        if (!search) {
            res.status(400).json({ error: "Informe o nome de um jogo para buscar." });
            return;
        }

        const payload = await searchGames({
            search,
            pageSize: normalizePageSize(req.query.page_size),
        });

        res.setHeader("Cache-Control", "no-store");
        res.json(payload);
    } catch (error) {
        next(error);
    }
});

app.get("/api/trending-games", async (req, res, next) => {
    try {
        const payload = await getTrendingGames({
            pageSize: normalizePageSize(req.query.page_size),
        });

        res.setHeader("Cache-Control", "no-store");
        res.json(payload);
    } catch (error) {
        next(error);
    }
});

app.get("/", sendFrontendFile("index.html"));
app.get("/index.html", sendFrontendFile("index.html"));
app.get("/style.css", sendFrontendFile("style.css"));
app.get("/script.js", sendFrontendFile("script.js"));

app.use((req, res) => {
    res.status(404).type("text/plain").send("Arquivo nao encontrado.");
});

app.use((error, req, res, next) => {
    console.error(error);

    res.status(error.status || 500).json({
        error: error.message || "Erro interno no servidor.",
        details: error.details,
    });
});

app.listen(PORT, () => {
    console.log(`Servidor Express rodando em http://localhost:${PORT}`);
});

function sendFrontendFile(fileName) {
    return (req, res) => {
        res.sendFile(path.join(FRONTEND_DIR, fileName));
    };
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
