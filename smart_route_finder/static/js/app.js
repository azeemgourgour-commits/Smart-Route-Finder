(() => {
  const $ = (id) => document.getElementById(id);
  const state = {
    origin: null, destination: null, routes: [], selectedRouteId: null,
    routeLayers: [], markers: [], theme: localStorage.getItem("routewise-theme") || "light",
    saved: JSON.parse(localStorage.getItem("routewise-saved") || "[]"),
    history: JSON.parse(localStorage.getItem("routewise-history") || "[]"),
    activeSection: "planner"
  };

  document.documentElement.dataset.theme = state.theme;
  $("themeToggle").textContent = state.theme === "dark" ? "☀" : "☾";

  const map = L.map("map", { zoomControl: false }).setView([30.7333, 76.7794], 11);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
  }).addTo(map);
  const routeColors = ["#5b5ce2", "#e4a23b", "#22a67a"];

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3000);
  }
  function money(value) { return "₹" + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }
  function persist() {
    localStorage.setItem("routewise-saved", JSON.stringify(state.saved));
    localStorage.setItem("routewise-history", JSON.stringify(state.history));
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  }
  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("routewise-theme", theme);
    $("themeToggle").textContent = theme === "dark" ? "☀" : "☾";
    $("themeToggle").title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  }
  $("themeToggle").addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));

  function clearMapLayers() {
    state.routeLayers.forEach(layer => map.removeLayer(layer));
    state.markers.forEach(marker => map.removeLayer(marker));
    state.routeLayers = []; state.markers = [];
  }
  function pinIcon(type) {
    return L.divIcon({ className: "", html: `<div class="map-pin ${type}"></div>`, iconSize: [17,17], iconAnchor: [8,8] });
  }
  function drawRoutes() {
    clearMapLayers();
    state.routes.forEach((route, idx) => {
      const latlngs = route.geometry.map(c => [c[1], c[0]]);
      const selected = route.id === state.selectedRouteId;
      const layer = L.polyline(latlngs, {
        color: routeColors[idx % routeColors.length], weight: selected ? 6 : 4,
        opacity: selected ? 0.95 : 0.42, lineCap: "round", lineJoin: "round"
      }).addTo(map);
      layer.on("click", () => selectRoute(route.id));
      state.routeLayers.push(layer);
    });
    if (state.origin) state.markers.push(L.marker([state.origin.lat,state.origin.lon], {icon:pinIcon("start")}).addTo(map).bindPopup("Starting point"));
    if (state.destination) state.markers.push(L.marker([state.destination.lat,state.destination.lon], {icon:pinIcon("end")}).addTo(map).bindPopup("Destination"));
    if (state.routes.length) {
      const selected = state.routes.find(r => r.id === state.selectedRouteId) || state.routes[0];
      const layer = state.routeLayers[state.routes.indexOf(selected)];
      if (layer) map.fitBounds(layer.getBounds(), {padding:[35,35]});
    } else if (state.origin && state.destination) {
      map.fitBounds([[state.origin.lat,state.origin.lon],[state.destination.lat,state.destination.lon]], {padding:[40,40]});
    } else if (state.origin) map.setView([state.origin.lat,state.origin.lon], 13);
  }
  function renderRoutes() {
    const container = $("routeResults");
    $("routeCount").textContent = `${state.routes.length} route${state.routes.length === 1 ? "" : "s"}`;
    if (!state.routes.length) {
      container.className = "empty-state";
      container.innerHTML = '<div class="empty-illustration">⌁</div><strong>Your routes will appear here</strong><p>Enter your start and destination to compare available routes.</p>';
      $("fuelCostValue").textContent = "₹—";
      $("fuelCostSub").textContent = "Select a route to calculate";
      return;
    }
    container.className = "";
    const priority = $("prioritySelect").value;
    const mileage = Math.max(Number($("mileageInput").value) || 18, 0.1);
    const price = Math.max(Number($("fuelPriceInput").value) || 0, 0);
    let routes = [...state.routes];
    if (priority === "time") routes.sort((a,b) => a.duration_min-b.duration_min);
    else if (priority === "distance") routes.sort((a,b) => a.distance_km-b.distance_km);
    else if (priority === "cost") routes.sort((a,b) => a.distance_km-b.distance_km);
    else routes.sort((a,b) => (a.duration_min/60 + a.distance_km/100) - (b.duration_min/60 + b.distance_km/100));
    container.innerHTML = routes.map((r, idx) => {
      const cost = r.distance_km / mileage * price;
      const selected = r.id === state.selectedRouteId;
      const badge = idx === 0 ? (priority === "time" ? "FASTEST" : priority === "distance" ? "SHORTEST" : priority === "cost" ? "LOWER COST" : "RECOMMENDED") : `OPTION ${idx+1}`;
      return `<article class="route-card ${selected ? "selected" : ""}" data-route-id="${r.id}" tabindex="0" role="button" aria-label="Select route ${idx+1}">
        <div class="route-card-head"><span class="route-name">${escapeHTML(r.summary)}</span><span class="route-badge">${badge}</span></div>
        <div class="route-metrics"><div class="metric"><strong>${r.duration_min} <small>min</small></strong><small>Estimated time</small></div><div class="metric"><strong>${r.distance_km.toFixed(1)} <small>km</small></strong><small>Distance</small></div><div class="metric"><strong>${money(cost)}</strong><small>Fuel estimate</small></div></div>
        <div class="route-card-footer"><span>Driving · estimate only</span><button type="button" data-save-route="${r.id}">☆ Save trip</button></div>
      </article>`;
    }).join("");
    container.querySelectorAll(".route-card").forEach(card => {
      const activate = () => selectRoute(Number(card.dataset.routeId));
      card.addEventListener("click", e => { if (!e.target.closest("[data-save-route]")) activate(); });
      card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } });
    });
    container.querySelectorAll("[data-save-route]").forEach(btn => btn.addEventListener("click", e => {
      e.stopPropagation();
      const r = state.routes.find(item => item.id === Number(btn.dataset.saveRoute));
      saveTrip(r);
    }));
    updateFuel();
  }
  function selectRoute(id) {
    state.selectedRouteId = id;
    drawRoutes();
    renderRoutes();
    const route = state.routes.find(r => r.id === id);
    if (route) $("smartTip").textContent = `${route.summary}: approximately ${route.duration_min} minutes over ${route.distance_km.toFixed(1)} km. Estimates may vary with actual road conditions.`;
  }
  function updateFuel() {
    const route = state.routes.find(r => r.id === state.selectedRouteId);
    if (!route) return;
    const mileage = Math.max(Number($("mileageInput").value) || 18, 0.1);
    const price = Math.max(Number($("fuelPriceInput").value) || 0, 0);
    const cost = route.distance_km / mileage * price;
    $("fuelCostValue").textContent = money(cost);
    $("fuelCostSub").textContent = `${(route.distance_km/mileage).toFixed(2)} litres for ${route.distance_km.toFixed(1)} km`;
  }

  async function geocode(query) {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not find location.");
    return data;
  }
  function bindAutocomplete(inputId, suggestionId, key) {
    const input = $(inputId), box = $(suggestionId);
    let timer;
    input.addEventListener("input", () => {
      state[key] = null;
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 3) { box.classList.remove("open"); box.innerHTML = ""; return; }
      box.innerHTML = '<div class="suggestion-item">Searching places…</div>';
      box.classList.add("open");
      timer = setTimeout(async () => {
        try {
          const items = await geocode(q);
          if (input.value.trim() !== q) return;
          box.innerHTML = items.length ? items.map((item, idx) => `<button class="suggestion-item" type="button" data-index="${idx}">${escapeHTML(item.name)}</button>`).join("") : '<div class="suggestion-item">No matches found.</div>';
          box.querySelectorAll("[data-index]").forEach(btn => btn.addEventListener("click", () => {
            const item = items[Number(btn.dataset.index)];
            state[key] = {lat:item.lat, lon:item.lon, name:item.name};
            input.value = item.name;
            box.classList.remove("open");
            if (key === "origin") map.setView([item.lat,item.lon], 13);
          }));
        } catch (err) {
          box.innerHTML = `<div class="suggestion-item">${escapeHTML(err.message)}</div>`;
        }
      }, 450);
    });
    document.addEventListener("click", e => { if (!box.contains(e.target) && e.target !== input) box.classList.remove("open"); });
  }
  bindAutocomplete("originInput", "originSuggestions", "origin");
  bindAutocomplete("destinationInput", "destinationSuggestions", "destination");

  async function findRoutes() {
    const originText = $("originInput").value.trim(), destText = $("destinationInput").value.trim();
    if (!originText || !destText) return toast("Please enter both starting point and destination.");
    $("findRouteBtn").disabled = true;
    $("findRouteBtn").innerHTML = "Finding routes…";
    try {
      if (!state.origin || state.origin.name !== originText) {
        const results = await geocode(originText);
        if (!results.length) throw new Error("Starting location not found. Select a suggestion.");
        state.origin = {...results[0], lon:results[0].lon};
      }
      if (!state.destination || state.destination.name !== destText) {
        const results = await geocode(destText);
        if (!results.length) throw new Error("Destination not found. Select a suggestion.");
        state.destination = {...results[0], lon:results[0].lon};
      }
      const response = await fetch("/api/route", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({origin:state.origin,destination:state.destination})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not calculate route.");
      state.routes = data.routes;
      state.selectedRouteId = state.routes[0]?.id ?? null;
      $("routeNotice").textContent = data.notice || "";
      $("routeNotice").classList.remove("hidden");
      drawRoutes(); renderRoutes();
      const record = {origin:state.origin.name || originText, destination:state.destination.name || destText, distance_km:state.routes[0]?.distance_km, duration_min:state.routes[0]?.duration_min, timestamp:new Date().toISOString()};
      state.history.unshift(record); state.history = state.history.slice(0,30); persist(); renderHistory();
      toast(`Found ${state.routes.length} route option(s).`);
    } catch (err) { toast(err.message); }
    finally { $("findRouteBtn").disabled = false; $("findRouteBtn").innerHTML = '<span>⌁</span> Find best routes <span class="btn-arrow">→</span>'; }
  }
  $("findRouteBtn").addEventListener("click", findRoutes);
  $("originInput").addEventListener("keydown", e => { if(e.key === "Enter") $("destinationInput").focus(); });
  $("destinationInput").addEventListener("keydown", e => { if(e.key === "Enter") findRoutes(); });
  $("swapBtn").addEventListener("click", () => {
    const a = $("originInput").value, b = $("destinationInput").value;
    $("originInput").value = b; $("destinationInput").value = a;
    const temp = state.origin; state.origin = state.destination; state.destination = temp;
  });
  $("prioritySelect").addEventListener("change", renderRoutes);
  $("mileageInput").addEventListener("input", () => { renderRoutes(); updateFuel(); });
  $("fuelPriceInput").addEventListener("input", () => { renderRoutes(); updateFuel(); });
  $("resetMapBtn").addEventListener("click", () => {
    if (state.routes.length) drawRoutes();
    else map.setView([30.7333,76.7794],11);
  });
  $("locateBtn").addEventListener("click", () => {
    if (!navigator.geolocation) return toast("Location is not supported by this browser.");
    navigator.geolocation.getCurrentPosition(pos => {
      state.origin = {lat:pos.coords.latitude,lon:pos.coords.longitude,name:"My current location"};
      $("originInput").value = "My current location";
      map.setView([state.origin.lat,state.origin.lon],14);
      toast("Current location added as starting point.");
    }, () => toast("Could not access location. Check browser location permission."), {enableHighAccuracy:true,timeout:10000});
  });
  document.querySelectorAll(".quick-place").forEach(btn => btn.addEventListener("click", () => {
    $("destinationInput").value = btn.dataset.place;
    state.destination = null;
    $("destinationInput").focus();
    toast(`${btn.dataset.place} selected as destination.`);
  }));

  function saveTrip(route) {
    if (!route) return;
    const record = {
      name:`${state.origin?.name || $("originInput").value} → ${state.destination?.name || $("destinationInput").value}`,
      origin:state.origin?.name || $("originInput").value,
      destination:state.destination?.name || $("destinationInput").value,
      distance_km:route.distance_km, duration_min:route.duration_min,
      timestamp:new Date().toISOString()
    };
    state.saved.unshift(record); state.saved = state.saved.slice(0,30); persist(); renderSaved();
    toast("Trip saved to your browser.");
  }
  function renderSaved() {
    const container = $("savedPlacesList");
    if (!state.saved.length) { container.innerHTML = '<div class="empty-list">No saved places or trips yet. Add a place above or save a route from Route planner.</div>'; return; }
    container.innerHTML = state.saved.map((item, i) => `<div class="saved-row"><div class="place-symbol">☆</div><div class="place-content"><strong>${escapeHTML(item.name || item.origin || "Saved place")}</strong><small>${item.distance_km ? `${item.distance_km} km · ${item.duration_min} min · ` : ""}${new Date(item.timestamp || Date.now()).toLocaleDateString()}</small></div><button data-use-saved="${i}">Use</button><button data-remove-saved="${i}" aria-label="Remove saved item">✕</button></div>`).join("");
    container.querySelectorAll("[data-use-saved]").forEach(btn => btn.addEventListener("click", () => {
      const item = state.saved[Number(btn.dataset.useSaved)];
      if (item.origin) $("originInput").value = item.origin;
      if (item.destination) $("destinationInput").value = item.destination;
      switchSection("planner"); toast("Saved trip loaded. Find routes to refresh.");
    }));
    container.querySelectorAll("[data-remove-saved]").forEach(btn => btn.addEventListener("click", () => {
      state.saved.splice(Number(btn.dataset.removeSaved),1); persist(); renderSaved();
    }));
  }
  function renderHistory() {
    const container = $("historyList");
    if (!state.history.length) { container.innerHTML = '<div class="empty-list">Your recent route searches will appear here.</div>'; return; }
    container.innerHTML = state.history.map((item, i) => `<div class="history-row"><div class="place-symbol">◷</div><div class="place-content"><strong>${escapeHTML(item.origin)} → ${escapeHTML(item.destination)}</strong><small>${item.distance_km ?? "—"} km · ${item.duration_min ?? "—"} min · ${new Date(item.timestamp).toLocaleString()}</small></div><button data-repeat="${i}">Repeat</button></div>`).join("");
    container.querySelectorAll("[data-repeat]").forEach(btn => btn.addEventListener("click", () => {
      const item = state.history[Number(btn.dataset.repeat)];
      $("originInput").value = item.origin; $("destinationInput").value = item.destination;
      state.origin = null; state.destination = null; switchSection("planner"); findRoutes();
    }));
  }
  $("savePlaceBtn").addEventListener("click", () => {
    const name = $("savePlaceInput").value.trim();
    if (!name) return toast("Enter a name for the place.");
    state.saved.unshift({name,timestamp:new Date().toISOString()});
    state.saved = state.saved.slice(0,30); persist(); renderSaved(); $("savePlaceInput").value = "";
    toast("Place saved.");
  });
  $("savePlaceInput").addEventListener("keydown", e => { if(e.key === "Enter") $("savePlaceBtn").click(); });
  $("clearHistoryBtn").addEventListener("click", () => {
    state.history = []; persist(); renderHistory(); toast("Trip history cleared.");
  });
  function switchSection(section) {
    state.activeSection = section;
    $("plannerSection").classList.toggle("hidden", section !== "planner");
    $("savedSection").classList.toggle("hidden", section !== "saved");
    $("historySection").classList.toggle("hidden", section !== "history");
    document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.section === section));
    const labels = {planner:["Route planner","Plan your next journey.","Find a better way to get there with smart route comparison."],saved:["Saved places","Your favourite places.","Keep frequent destinations close at hand."],history:["Trip history","Every journey, in one place.","Review and repeat your recent route searches."]};
    $("pageTitle").textContent = labels[section][0]; $("headingTitle").textContent = labels[section][1]; $("headingSubtitle").textContent = labels[section][2];
    if (section === "planner") setTimeout(() => map.invalidateSize(), 80);
  }
  document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => switchSection(btn.dataset.section)));
  renderSaved(); renderHistory();
  setTimeout(() => map.invalidateSize(), 200);
})();
