/* PlayZyro shared functional core - GitHub/Cloudflare stage demo data layer.
   Demo only: all data lives in this browser (localStorage). Real accounts,
   tournaments and room credentials are created through the site's own flows.
   Mirrors the later WordPress tables: users, squads, tournaments, events,
   applications, assignments, rooms. */
window.PZ_VERSION = '2026-11-20a';
(function () {
  var V = window.PZ_VARIANT || 'vx';
  var KEY = 'pz_' + V + '_db_v1';
  var SKEY = 'pz_' + V + '_session_v1';

  function uid(p) { return p + Math.random().toString(36).slice(2, 8).toUpperCase(); }
  function code() { return 'PZ-' + Math.random().toString(36).slice(2, 6).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(); }

  function seed() {
    var users = [
      { id: 'u_admin', username: 'demo_admin', email: 'demo-admin@example.local', pass: 'demo1234', role: 'admin' },
      { id: 'u_player', username: 'DemoPlayer', email: 'demo-player@example.local', pass: 'demo1234', role: 'user' },
      { id: 'u_m2', username: 'DemoMember2', email: 'demo-member2@example.local', pass: 'demo1234', role: 'user' },
      { id: 'u_m3', username: 'DemoMember3', email: 'demo-member3@example.local', pass: 'demo1234', role: 'user' },
      { id: 'u_m4', username: 'DemoMember4', email: 'demo-member4@example.local', pass: 'demo1234', role: 'user' }
    ];
    var squads = [
      { id: 's_demo', name: 'Demo Squad (Example)', captainId: 'u_player', memberIds: ['u_player', 'u_m2', 'u_m3', 'u_m4'], joinCode: 'PZ-DEMO1' }
    ];
    var tournaments = [
      { id: 't1', name: 'Demo Tournament 1 (Example)', dateText: 'Date to be confirmed', timeText: '', mode: 'Squad', status: 'Registration Open', slots: '' },
      { id: 't2', name: 'Demo Tournament 2 (Example)', dateText: 'Date to be confirmed', timeText: '', mode: 'Squad', status: 'Upcoming', slots: '' },
      { id: 't3', name: 'Demo Tournament 3 (Example)', dateText: 'Date to be confirmed', timeText: '', mode: 'Squad', status: 'Upcoming', slots: '' }
    ];
    var events = [
      { id: 'e1', title: 'Demo Event 1 (Example)', dateText: 'Date to be confirmed' },
      { id: 'e2', title: 'Demo Event 2 (Example)', dateText: 'Date to be confirmed' }
    ];
    return { users: users, squads: squads, tournaments: tournaments, events: events, applications: [], assignments: [], rooms: {} };
  }

  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    var db = seed(); save(db); return db;
  }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

  var PZ = {
    db: load(),
    save: function () { save(PZ.db); },
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },
    qs: function (n) { return new URLSearchParams(location.search).get(n); },
    user: function (id) { return PZ.db.users.find(function (u) { return u.id === id; }) || null; },
    session: function () { try { var id = localStorage.getItem(SKEY); return id ? PZ.user(id) : null; } catch (e) { return null; } },
    login: function (who, pass) {
      /* V10 divergence (Admin-R1-03): accounts flagged banned in the admin panel cannot log in. */
      var u = PZ.db.users.find(function (x) { return (x.username.toLowerCase() === String(who).toLowerCase() || x.email.toLowerCase() === String(who).toLowerCase()) && x.pass === pass && !x.banned; });
      if (!u) return null;
      try { localStorage.setItem(SKEY, u.id); } catch (e) {}
      return u;
    },
    signup: function (username, email, pass) {
      if (PZ.db.users.some(function (x) { return x.username.toLowerCase() === username.toLowerCase() || x.email.toLowerCase() === email.toLowerCase(); })) return { error: 'That username or email is already registered. Log in instead.' };
      var u = { id: uid('u_'), username: username, email: email, pass: pass, role: 'user' };
      PZ.db.users.push(u); PZ.save();
      try { localStorage.setItem(SKEY, u.id); } catch (e) {}
      return { user: u };
    },
    logout: function () { try { localStorage.removeItem(SKEY); } catch (e) {} location.href = 'index.html'; },
    mySquad: function (userId) { return PZ.db.squads.find(function (s) { return s.memberIds.indexOf(userId) > -1; }) || null; },
    createSquad: function (user, name) {
      if (PZ.mySquad(user.id)) return { error: 'You already have an active squad. One active squad per user.' };
      var s = { id: uid('s_'), name: name, captainId: user.id, memberIds: [user.id], joinCode: code() };
      PZ.db.squads.push(s); PZ.save(); return { squad: s };
    },
    joinSquad: function (user, joinCode) {
      var s = PZ.db.squads.find(function (x) { return x.joinCode.toUpperCase() === String(joinCode).trim().toUpperCase(); });
      if (!s) return { error: 'No squad found with that code. Check the code and try again.' };
      if (PZ.mySquad(user.id)) return { error: 'You already have an active squad. One active squad per user.' };
      if (s.memberIds.length >= 5) return { error: 'That squad is full (5 members maximum).' };
      s.memberIds.push(user.id); PZ.save(); return { squad: s };
    },
    apply: function (squad, tournamentId) {
      if (!squad) return { error: 'Create or join a squad first, then apply.' };
      if (squad.memberIds.length < 4) return { error: 'Your squad needs at least 4 members (captain + 3) to apply. Your squad has ' + squad.memberIds.length + '.' };
      if (PZ.db.applications.some(function (a) { return a.squadId === squad.id && a.tournamentId === tournamentId; })) return { error: 'Your squad has already applied for this tournament.' };
      PZ.db.applications.push({ id: uid('a_'), squadId: squad.id, tournamentId: tournamentId, status: 'Pending' }); PZ.save();
      return { ok: true };
    },
    appliedSquadIds: function (tournamentId) { return PZ.db.applications.filter(function (a) { return a.tournamentId === tournamentId; }).map(function (a) { return a.squadId; }); },
    assignedSquadIds: function (tournamentId) { return PZ.db.assignments.filter(function (a) { return a.tournamentId === tournamentId; }).map(function (a) { return a.squadId; }); },
    isAssigned: function (squadId, tournamentId) { return PZ.db.assignments.some(function (a) { return a.squadId === squadId && a.tournamentId === tournamentId; }); },
    assign: function (tournamentId, squadId) {
      if (PZ.isAssigned(squadId, tournamentId)) return;
      PZ.db.assignments.push({ id: uid('as_'), tournamentId: tournamentId, squadId: squadId });
      var app = PZ.db.applications.find(function (a) { return a.squadId === squadId && a.tournamentId === tournamentId; });
      if (app) app.status = 'Assigned';
      PZ.save();
    },
    publishRoom: function (tournamentId, roomId, password) { PZ.db.rooms[tournamentId] = { roomId: roomId, password: password, published: true }; PZ.save(); },
    roomFor: function (user, tournamentId) {
      var room = PZ.db.rooms[tournamentId];
      if (!room || !room.published) return null;
      var s = PZ.mySquad(user.id);
      if (!s || !PZ.isAssigned(s.id, tournamentId)) return null;
      return room;
    },
    myTournaments: function (user) {
      var s = PZ.mySquad(user.id); if (!s) return [];
      var ids = {};
      PZ.db.applications.filter(function (a) { return a.squadId === s.id; }).forEach(function (a) { ids[a.tournamentId] = true; });
      PZ.db.assignments.filter(function (a) { return a.squadId === s.id; }).forEach(function (a) { ids[a.tournamentId] = true; });
      return PZ.db.tournaments.filter(function (t) { return ids[t.id]; });
    },
    toast: function (msg) {
      var t = document.createElement('div'); t.className = 'pz-toast'; t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function () { t.classList.add('show'); }, 10);
      setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 3200);
    },
    requireAuth: function () { var u = PZ.session(); if (!u) { location.href = 'auth.html?next=' + encodeURIComponent(location.pathname.split('/').pop()); return null; } return u; },
    mountUserChip: function () {
      var u = PZ.session();
      document.querySelectorAll('[data-user-chip]').forEach(function (el) {
        if (u) { el.innerHTML = PZ.esc(u.username) + ' &nbsp;<a href="#" data-logout style="color:inherit;text-decoration:underline">Log out</a>'; }
        else { el.innerHTML = '<a class="login-link" href="auth.html">Log In</a> <a class="btn outline sm" href="auth.html">Register</a>'; }
      });
      document.querySelectorAll('[data-logout]').forEach(function (el) { el.addEventListener('click', function (e) { e.preventDefault(); PZ.logout(); }); });
    }
  };
  window.PZ = PZ;

  /* R2: mobile slide-in drawer. Built from the page's own nav so every page
     gets the same drawer: full nav + login/register (or user + log out). */
  function buildDrawer() {
    var headerIn = document.querySelector('header.site .header-in');
    if (!headerIn || document.querySelector('.drawer')) return;
    var burger = document.createElement('button');
    burger.type = 'button';
    burger.className = 'nav-toggle';
    burger.setAttribute('aria-label', 'Open menu');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
    headerIn.appendChild(burger);

    var backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    var drawer = document.createElement('aside');
    drawer.className = 'drawer';
    drawer.setAttribute('aria-label', 'Menu');
    var links = [];
    document.querySelectorAll('header.site nav.main a').forEach(function (a) {
      if (a.style.display === 'none') return;
      links.push('<a href="' + a.getAttribute('href') + '">' + a.innerHTML + '</a>');
    });
    var authHtml;
    if (document.querySelector('header.site [data-user-chip]')) {
      authHtml = '<span data-user-chip></span>';
    } else {
      var u = PZ.session();
      authHtml = u
        ? '<span class="drawer-user">' + PZ.esc(u.username) + '</span><a class="btn block ghost" href="#" data-logout>Log out</a>'
        : '<a class="btn block" href="auth.html">Log In</a><a class="btn block outline" href="auth.html">Register</a>';
    }
    drawer.innerHTML = '<div class="drawer-head"><a class="logo" href="index.html">PLAY<span class="z">Z</span>YRO</a>'
      + '<button type="button" class="drawer-close" aria-label="Close menu"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>'
      + '<nav>' + links.join('') + '</nav>'
      + '<div class="drawer-auth">' + authHtml + '</div>';
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    function setOpen(open) {
      drawer.classList.toggle('open', open);
      backdrop.classList.toggle('show', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    burger.addEventListener('click', function () { setOpen(true); });
    backdrop.addEventListener('click', function () { setOpen(false); });
    drawer.querySelector('.drawer-close').addEventListener('click', function () { setOpen(false); });
    drawer.querySelectorAll('nav a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  document.addEventListener('DOMContentLoaded', function () { buildDrawer(); PZ.mountUserChip(); });
})();
