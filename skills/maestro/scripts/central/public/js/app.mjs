// Entry point: token, routing between the tabs, the host filter, the live event stream, and the "N s ago" clock.

import { ago, MAESTRO_MARK } from "./format.mjs";
import { primeSeen } from "./feed.mjs";
import { renderLive } from "./live.mjs";
import { mountMap, updateMap } from "./map.mjs";
import { renderSettings } from "./settings.mjs";
import { renderCluster, hostBarHtml, filterByHost, hostById } from "./cluster.mjs";
import { bindDetails, setDetailSnapshot } from "./detail.mjs";

const view = document.getElementById("view");
const conn = document.getElementById("conn");
const hostbar = document.getElementById("hostbar");
let snapshot = null;
let primed = false;
let hostFilter = readHostFilter();

function readHostFilter() {
    try {
        return sessionStorage.getItem("maestro-central-host") || null;
    } catch {
        return null;
    }
}

function setHostFilter(id) {
    hostFilter = id || null;
    try {
        if (hostFilter) {
            sessionStorage.setItem("maestro-central-host", hostFilter);
        } else {
            sessionStorage.removeItem("maestro-central-host");
        }
    } catch {
        // Session storage is only a convenience here.
    }
}

function readToken() {
    const fromUrl = new URLSearchParams(location.search).get("token");
    try {
        if (fromUrl) {
            sessionStorage.setItem("maestro-central-token", fromUrl);
            return fromUrl;
        }
        return sessionStorage.getItem("maestro-central-token") || "";
    } catch {
        return fromUrl || "";
    }
}

const token = readToken();

function setConn(state, label) {
    conn.classList.toggle("is-live", state === "live");
    conn.classList.toggle("is-down", state === "down");
    conn.querySelector(".conn-label").textContent = label;
}

function route() {
    return { "/map": "map", "/settings": "settings", "/cluster": "cluster" }[location.pathname] || "fleet";
}

function markNav() {
    const current = { map: "/map", settings: "/settings", cluster: "/cluster", fleet: "/" }[route()];
    for (const link of document.querySelectorAll(".nav a")) {
        if (link.getAttribute("href") === current) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    }
}

function render() {
    markNav();
    if (!snapshot) {
        return;
    }
    if (!primed) {
        primeSeen(snapshot.feed);
        primed = true;
    }
    // Fleet and Map follow the host filter; a filter on a machine that left the cluster is dropped.
    if (hostFilter && !hostById(snapshot, hostFilter)) {
        setHostFilter(null);
    }
    const filtered = filterByHost(snapshot, hostFilter);
    const showBar = route() === "fleet" || route() === "map";
    hostbar.innerHTML = showBar ? hostBarHtml(snapshot, hostFilter) : "";
    hostbar.hidden = !hostbar.innerHTML;
    if (route() === "map") {
        // The map is mounted once and updated in place, so pan and zoom survive live updates.
        if (view.dataset.view !== "map") {
            view.dataset.view = "map";
            view.innerHTML = `<section class="map-band map-page"></section>`;
            mountMap(view.firstElementChild);
        }
        updateMap(filtered);
    } else if (route() === "settings") {
        view.dataset.view = "settings";
        renderSettings(view, snapshot);
    } else if (route() === "cluster") {
        view.dataset.view = "cluster";
        renderCluster(view, snapshot);
    } else {
        view.dataset.view = "fleet";
        renderLive(view, filtered);
    }
    // After the render, so the tooltip finds the new element under the pointer and an open modal refreshes.
    setDetailSnapshot(snapshot);
}

function navigate(href) {
    const url = new URL(href, location.origin);
    if (url.pathname === location.pathname) {
        return;
    }
    history.pushState(null, "", url.pathname);
    view.dataset.view = "";
    render();
    window.scrollTo(0, 0);
}

document.addEventListener("click", (event) => {
    const filter = event.target.closest("[data-host-filter]");
    if (filter) {
        setHostFilter(filter.dataset.hostFilter || null);
        render();
        return;
    }
    const link = event.target.closest("a[data-link]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
    }
    event.preventDefault();
    navigate(link.getAttribute("href"));
});

window.addEventListener("popstate", () => {
    view.dataset.view = "";
    render();
});

let resizeTimer = null;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (route() === "fleet") {
            render();
        }
    }, 150);
});

function connect() {
    if (!token) {
        setConn("down", "no token");
        view.innerHTML = `<div class="wrap"><p class="empty">Open the central from the link that <code>central start</code> prints. It carries the session token.</p></div>`;
        return;
    }
    const source = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
    source.addEventListener("state", (event) => {
        snapshot = JSON.parse(event.data);
        setConn("live", "live");
        render();
    });
    source.addEventListener("open", () => setConn("live", "live"));
    source.addEventListener("error", () => {
        if (source.readyState === EventSource.CLOSED) {
            // The server refused the stream (a new token after a restart, or it is gone). Retry slowly.
            setConn("down", "offline");
            source.close();
            setTimeout(connect, 5000);
        } else {
            setConn("down", "reconnecting");
        }
    });
}

setInterval(() => {
    const now = Date.now();
    for (const node of document.querySelectorAll("[data-ago]")) {
        const ts = node.getAttribute("data-ago");
        if (ts) {
            node.textContent = ago(ts, now);
        }
    }
}, 1000);

for (const slot of document.querySelectorAll("[data-mark]")) {
    slot.innerHTML = MAESTRO_MARK;
}
markNav();
bindDetails();
connect();
