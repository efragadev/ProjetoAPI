const form = document.querySelector(".busca-jogo");
const input = document.querySelector("#jogo");
const container = document.querySelector(".game-container");
const resultsDescription = document.querySelector("#results-description");
const heroCarousel = document.querySelector(".hero-carousel");
const heroEyebrow = document.querySelector("#hero-eyebrow");
const heroTitle = document.querySelector("#hero-title");
const heroDescription = document.querySelector("#hero-description");
const heroMeta = document.querySelector("#hero-meta");
const heroIndicators = Array.from(document.querySelectorAll(".carousel-indicators button"));

let featuredGames = [];
let activeSlideIndex = 0;
let carouselTimer;

initHeroCarousel();

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const search = input.value.trim();

    if (!search) {
        renderMessage("empty-state", "Digite o nome de um jogo para buscar.");
        input.focus();
        return;
    }

    renderLoading();

    try {
        const response = await fetch(`/api/games?search=${encodeURIComponent(search)}&page_size=12`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Nao foi possivel buscar jogos.");
        }

        renderGames(data.results || [], search);
    } catch (error) {
        renderMessage("error-state", error.message);
        resultsDescription.textContent = "A busca falhou. Verifique o backend e tente novamente.";
    }
});

async function initHeroCarousel() {
    try {
        const response = await fetch("/api/trending-games?page_size=4");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Nao foi possivel carregar jogos em alta.");
        }

        featuredGames = (data.results || []).slice(0, 4);

        if (!featuredGames.length) {
            return;
        }

        syncHeroIndicators();
        renderHeroSlide(0);
        startCarousel();
        heroIndicators.forEach((button, index) => {
            button.addEventListener("click", () => {
                renderHeroSlide(index);
                startCarousel();
            });
        });
    } catch (error) {
        heroMeta.textContent = error.message;
    }
}

function syncHeroIndicators() {
    heroIndicators.forEach((button, index) => {
        button.hidden = index >= featuredGames.length;
    });
}

function startCarousel() {
    window.clearInterval(carouselTimer);

    carouselTimer = window.setInterval(() => {
        const nextIndex = (activeSlideIndex + 1) % featuredGames.length;
        renderHeroSlide(nextIndex);
    }, 6000);
}

function renderHeroSlide(index) {
    const game = featuredGames[index];

    if (!game) {
        return;
    }

    activeSlideIndex = index;
    heroCarousel.classList.add("is-changing");

    window.setTimeout(() => {
        heroCarousel.style.setProperty("--hero-image", `url("${game.background_image}")`);
        heroEyebrow.textContent = "Jogos do momento";
        heroTitle.textContent = game.name;
        heroDescription.textContent = createHeroDescription(game);
        heroMeta.textContent = createHeroMeta(game);
        updateHeroIndicators(index);
        heroCarousel.classList.remove("is-changing");
    }, 220);
}

function updateHeroIndicators(activeIndex) {
    heroIndicators.forEach((button, index) => {
        const isActive = index === activeIndex;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-current", isActive ? "true" : "false");
    });
}

function createHeroDescription(game) {
    const genres = game.genres?.slice(0, 2).join(" e ");

    if (genres) {
        return `${genres} em destaque agora na RAWG.`;
    }

    return "Um dos jogos em alta agora na RAWG.";
}

function createHeroMeta(game) {
    const released = game.released ? formatDate(game.released) : "sem data";
    const rating = Number.isFinite(game.rating) ? `nota ${game.rating.toFixed(1)}` : "sem nota";

    return `${released} - ${rating}`;
}

function renderLoading() {
    resultsDescription.textContent = "Buscando jogos...";
    container.innerHTML = `
        <div class="loading-state">
            <span class="loader" aria-hidden="true"></span>
            <span>Carregando resultados...</span>
        </div>
    `;
}

function renderGames(games, search) {
    if (!games.length) {
        renderMessage("empty-state", `Nenhum jogo encontrado para "${search}".`);
        resultsDescription.textContent = "Tente buscar por outro nome.";
        return;
    }

    resultsDescription.textContent = `${games.length} resultado(s) encontrado(s) para "${search}".`;
    container.innerHTML = games.map(createGameCard).join("");
}

function createGameCard(game) {
    const image = game.background_image || "";
    const genres = game.genres?.length ? game.genres.join(", ") : "Generos nao informados";
    const platforms = game.platforms?.length ? game.platforms.slice(0, 3).join(", ") : "Plataformas nao informadas";
    const released = game.released ? formatDate(game.released) : "Sem data";
    const rating = Number.isFinite(game.rating) ? game.rating.toFixed(1) : "N/A";

    return `
        <article class="game-card">
            ${
                image
                    ? `<img src="${escapeHtml(image)}" alt="Capa do jogo ${escapeHtml(game.name)}" loading="lazy">`
                    : `<div class="game-image-placeholder">Sem imagem disponivel</div>`
            }
            <div class="game-info">
                <h3>${escapeHtml(game.name)}</h3>
                <div class="game-meta">
                    <span>${escapeHtml(released)}</span>
                    <span>${escapeHtml(rating)}</span>
                </div>
                <p class="genre">${escapeHtml(genres)}</p>
                <p class="genre">${escapeHtml(platforms)}</p>
            </div>
        </article>
    `;
}

function renderMessage(className, message) {
    container.innerHTML = `<div class="${className}">${escapeHtml(message)}</div>`;
}

function formatDate(date) {
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(`${date}T00:00:00`));
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
