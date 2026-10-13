/* MAC Obras – app para trabajadores y administración
   Servicios de Construcción MAC Ltda. */
(function () {
  'use strict';

  var CFG = window.MAC_CONFIG || {};
  var API = CFG.API_URL || '';
  var $app = document.getElementById('app');
  var S = {
    ses: cargar('ses'), inicio: cargar('inicio'), equipo: cargar('equipo'), admin: null, adminFecha: null,
    cola: [], syncing: false, ruta: '', tmp: {}
  };

  /* ============================================================ utilidades */
  function cargar(k) { try { return JSON.parse(localStorage.getItem('mac_' + k)); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem('mac_' + k, JSON.stringify(v)); } catch (e) { /* lleno */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoLocal(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function hoyLocal() { return isoLocal(new Date()).substr(0, 10); }
  function hora(iso) { return iso ? String(iso).substr(11, 5) : '--:--'; }
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function fechaLarga(f) { var d = new Date(f + 'T12:00:00'); return DIAS[d.getDay()].replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }
  function fechaCorta(f) { return f ? String(f).substr(8, 2) + '-' + String(f).substr(5, 2) + '-' + String(f).substr(0, 4) : ''; }
  function iniciales(n) { return String(n || '?').split(' ').filter(Boolean).slice(0, 2).map(function (p) { return p[0]; }).join('').toUpperCase(); }
  function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2)); }
  function coords(g) { return g && g.lat != null && g.lat !== '' ? Number(g.lat).toFixed(5) + ', ' + Number(g.lng).toFixed(5) : 'sin GPS'; }
  function mapa(lat, lng) { return 'https://maps.google.com/?q=' + lat + ',' + lng; }
  function enLinea() { return navigator.onLine !== false; }
  function toast(t) { var el = document.getElementById('toast'); el.textContent = t; el.classList.add('ver'); clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove('ver'); }, 3200); }
  function esAdmin() { return S.ses && S.ses.user && S.ses.user.rol === 'admin'; }
  function num(v) { var n = Number(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; }

  var ICON = {
    volver: '<path d="m15 18-6-6 6-6"/>', cam: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    gal: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>', ok: '<path d="M20 6 9 17l-5-5"/>',
    sube: '<path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 20h16"/>', casa: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    caja: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>', nube: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/>',
    panel: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>', reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sinred: '<path d="M12 20h.01"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.8"/><path d="M2 8.8a15 15 0 0 1 4.2-2.6"/><path d="M19 12.9a10 10 0 0 0-1.6-1.2"/><path d="m2 2 20 20"/>', mas: '<path d="M12 5v14"/><path d="M5 12h14"/>'
  };
  function ico(n, size, color) { return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="' + (color || 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + '</svg>'; }

  /* ============================================================ servidor */
  function api(obj, ms) {
    if (!/^https?:\/\//.test(API)) return Promise.reject(new Error('CONFIG'));
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, ms || 30000);
    return fetch(API, { method: 'POST', body: JSON.stringify(obj), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctl.signal, redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .finally(function () { clearTimeout(t); });
  }
  function apiSes(obj, ms) {
    obj.token = S.ses && S.ses.token;
    return api(obj, ms).then(function (r) {
      if (r && r.error === 'SESION') { salir(true); throw new Error(r.mensaje || 'Sesión vencida'); }
      return r;
    });
  }

  /* ============================================================ cola sin señal (IndexedDB) */
  var dbp = null;
  function db() {
    return dbp || (dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('macobras', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('cola', { keyPath: 'id' }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    }));
  }
  function tx(modo, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('cola', modo), req = fn(t.objectStore('cola'));
        t.oncomplete = function () { res(req ? req.result : undefined); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  var cola = {
    todas: function () { return tx('readonly', function (s) { return s.getAll(); }); },
    poner: function (op) { return tx('readwrite', function (s) { return s.put(op); }); },
    quitar: function (id) { return tx('readwrite', function (s) { return s.delete(id); }); }
  };
  function leerCola() {
    return cola.todas().then(function (a) { S.cola = (a || []).sort(function (x, y) { return x.creado < y.creado ? -1 : 1; }); actualizarBadges(); });
  }
  function encolar(kind, data) {
    var op = { id: uuid(), kind: kind, data: data, creado: isoLocal(new Date()), token: S.ses.token, userId: S.ses.user.id, error: null };
    return cola.poner(op).then(leerCola).then(function () { sincronizar(); return op; });
  }

  function sincronizar() {
    if (S.syncing || !S.cola.length || !enLinea()) return Promise.resolve();
    S.syncing = true; actualizarBadges();
    var hubo = false;
    var lista = S.cola.slice();
    function siguiente(i) {
      if (i >= lista.length) return Promise.resolve();
      var op = lista[i];
      return api({ action: 'sync', token: op.token, op: { id: op.id, kind: op.kind, data: op.data } }, op.kind === 'foto' ? 120000 : 30000)
        .then(function (r) {
          if (r && r.ok) { hubo = true; return cola.quitar(op.id).then(function () { return siguiente(i + 1); }); }
          if (r && r.error === 'PERMISO') {          // no se reintenta: no está permitido
            toast(r.mensaje || 'Acción no permitida');
            if (op.kind === 'borrarFoto') marcarBorrada(op.data.fotoId, false);
            return cola.quitar(op.id).then(function () { return siguiente(i + 1); });
          }
          op.error = r && r.error === 'SESION' ? 'Sesión vencida: vuelve a ingresar' : ((r && (r.mensaje || r.error)) || 'Error');
          op.intentos = (op.intentos || 0) + 1;
          return cola.poner(op).then(function () { return siguiente(i + 1); });
        });
    }
    return siguiente(0).catch(function () { /* sin señal: se reintenta después */ })
      .then(function () { S.syncing = false; return leerCola(); })
      .then(function () {
        if (hubo) { toast('Registros enviados ✓'); return cargarInicio(); }
      }).then(refrescarVista);
  }

  function cargarInicio() {
    if (!S.ses || !enLinea()) return Promise.resolve();
    return apiSes({ action: 'inicio' }).then(function (r) {
      if (r && r.ok) { S.inicio = r; guardar('inicio', r); }
    }).catch(function () {});
  }

  /* ============================================================ estado local (servidor + cola) */
  function obraPorId(id) {
    var i = S.inicio || {};
    return (i.asignadas || []).concat(i.otras || []).filter(function (o) { return o.id === id; })[0];
  }
  function opsDe(obraId, kind) { return S.cola.filter(function (o) { return o.kind === kind && o.data.obraId === obraId && o.userId === S.ses.user.id; }); }
  function estadoObra(o) {
    var hoy = hoyLocal();
    var ll = opsDe(o.id, 'asistencia').filter(function (x) { return x.data.tipo === 'LLEGADA' && x.data.fecha === hoy; })[0];
    var sa = opsDe(o.id, 'asistencia').filter(function (x) { return x.data.tipo === 'SALIDA' && x.data.fecha === hoy; })[0];
    var esServidorHoy = S.inicio && S.inicio.hoy === hoy;
    var hechas = {}, enCola = {};
    (o.hechas || []).forEach(function (i) { hechas[i] = true; });
    opsDe(o.id, 'foto').forEach(function (x) { if (x.data.tipo === 'SOLICITADA') enCola[x.data.item] = true; });
    var bit = opsDe(o.id, 'bitacora').filter(function (x) { return x.data.fecha === hoy; })[0];
    return {
      llegada: ll ? { hora: ll.data.hora, gps: ll.data, cola: true } : (esServidorHoy && o.llegada ? { hora: o.llegada } : null),
      salida: sa ? { hora: sa.data.hora, cola: true } : (esServidorHoy && o.salida ? { hora: o.salida } : null),
      hechas: hechas, enCola: enCola,
      listas: (o.fotosReq || []).filter(function (i) { return hechas[i] || enCola[i]; }).length,
      cierre: bit ? bit.data : (esServidorHoy ? o.cierre : null)
    };
  }
  function thumbs() { return cargar('thumbs') || []; }
  function agregarThumb(t) { var a = thumbs(); a.unshift(t); guardar('thumbs', a.slice(0, 40)); }
  function quitarThumb(id) { guardar('thumbs', thumbs().filter(function (t) { return t.id !== id; })); }
  function borradas() { var o = {}; (cargar('borradas') || []).forEach(function (id) { o[id] = true; }); return o; }
  function marcarBorrada(id, si) {
    var a = (cargar('borradas') || []).filter(function (x) { return x !== id; });
    if (si !== false) a.unshift(id);
    guardar('borradas', a.slice(0, 300));
  }
  function misFotosObra(o) {
    var hoy = hoyLocal(), borr = borradas(), th = thumbs(), vistos = {}, out = [];
    S.cola.forEach(function (op) { if (op.kind === 'borrarFoto') borr[op.data.fotoId] = true; });
    var thumbDe = function (id) { var t = th.filter(function (x) { return x.id === id; })[0]; return t && t.thumb; };
    S.cola.forEach(function (op) {
      if (op.kind !== 'foto' || op.data.obraId !== o.id || op.userId !== S.ses.user.id) return;
      out.push({ id: op.id, item: op.data.item || 'Avance', hora: op.data.hora, src: thumbDe(op.id) || op.data.imagen, cola: true }); vistos[op.id] = 1;
    });
    if (S.inicio && S.inicio.hoy === hoy) (o.misFotos || []).forEach(function (f) {
      if (vistos[f.id] || borr[f.id]) return;
      out.push({ id: f.id, item: f.item || 'Avance', hora: f.hora, src: thumbDe(f.id) || f.url }); vistos[f.id] = 1;
    });
    th.forEach(function (t) {
      if (t.id && !vistos[t.id] && !borr[t.id] && t.obraId === o.id && t.fecha === hoy) { out.push({ id: t.id, item: t.item, hora: t.hora, src: t.thumb }); vistos[t.id] = 1; }
    });
    return out.sort(function (a, b) { return a.hora < b.hora ? 1 : -1; });
  }

  /* ============================================================ GPS y fotos */
  function obtenerGPS() {
    return new Promise(function (res) {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(function (p) {
        res({ lat: p.coords.latitude, lng: p.coords.longitude, precision: Math.round(p.coords.accuracy) });
      }, function () { res(null); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
  }
  function conLimite(p, ms) { return Promise.race([p, new Promise(function (r) { setTimeout(function () { r(null); }, ms); })]); }

  function procesarImagen(file, lineas) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la foto')); };
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        w = Math.round(w * k); h = Math.round(h * k);
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
        var fs = Math.max(14, Math.round(w * 0.022)), bandH = Math.round(fs * 1.45 * lineas.length + fs * 0.9);
        x.fillStyle = 'rgba(0,0,0,0.62)'; x.fillRect(0, h - bandH, w, bandH);
        x.fillStyle = '#F5C518'; x.fillRect(0, h - bandH, Math.max(6, Math.round(w * 0.008)), bandH);
        x.fillStyle = '#ffffff'; x.textBaseline = 'top'; x.font = '600 ' + fs + 'px Barlow, Arial, sans-serif';
        lineas.forEach(function (l, i) { x.fillText(l, fs * 0.9, h - bandH + fs * 0.45 + i * fs * 1.45, w - fs * 1.8); });
        URL.revokeObjectURL(url);
        var t = document.createElement('canvas'), tk = 220 / Math.max(w, h);
        t.width = Math.round(w * tk); t.height = Math.round(h * tk); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
        res({ data: c.toDataURL('image/jpeg', 0.72), thumb: t.toDataURL('image/jpeg', 0.6) });
      };
      img.src = url;
    });
  }

  function tomarFoto(obra, opts) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    if (opts.camara) inp.setAttribute('capture', 'environment');
    inp.className = 'oculto'; document.body.appendChild(inp);
    var gpsP = obtenerGPS();                      // se pide mientras se abre la cámara
    inp.onchange = function () {
      var file = inp.files && inp.files[0];
      inp.remove();
      if (!file) return;
      var momento = opts.camara ? new Date() : new Date(file.lastModified || Date.now());
      toast('Guardando foto…');
      conLimite(gpsP, 8000).then(function (g) {
        var iso = isoLocal(momento);
        var lineas = [obra.nombre + ' · ' + (opts.item || 'Avance') + (opts.comentario ? ' – ' + opts.comentario : ''),
          fechaCorta(iso.substr(0, 10)) + ' ' + iso.substr(11, 8) + ' · ' + (g ? coords(g) + ' ±' + g.precision + ' m' : 'sin GPS') + ' · ' + S.ses.user.nombre];
        return procesarImagen(file, lineas).then(function (img) {
          return encolar('foto', {
            fecha: iso.substr(0, 10), hora: iso, obraId: obra.id, tipo: opts.item ? 'SOLICITADA' : 'AVANCE', item: opts.item || '',
            comentario: opts.comentario || '', lat: g ? g.lat : '', lng: g ? g.lng : '', precision: g ? g.precision : '',
            origen: opts.camara ? 'camara' : 'galeria', imagen: img.data
          }).then(function (op) {
            agregarThumb({ id: op.id, obraId: obra.id, fecha: iso.substr(0, 10), item: opts.item || 'Avance', hora: iso, thumb: img.thumb });
          });
        });
      }).then(function () {
        toast(enLinea() ? 'Foto guardada, subiendo…' : 'Foto guardada en el teléfono. Se sube al volver la señal.');
        render();
      }).catch(function (e) { toast(e.message || 'Error con la foto'); });
    };
    inp.click();
  }

  /* ============================================================ vistas: estructura */
  function nav(act) {
    var n = S.cola.length;
    var items = [['hoy', '#/hoy', 'casa', 'Hoy'], ['bodega', '#/bodega', 'caja', 'Bodega'], ['cola', '#/cola', 'nube', 'Envíos']];
    if (esAdmin()) items.push(['admin', '#/admin', 'panel', 'Panel']);
    items.push(['salir', '#/salir', 'salir', 'Salir']);
    return '<nav class="nav noimprimir">' + items.map(function (i) {
      return '<a href="' + i[1] + '" class="' + (act === i[0] ? 'act' : '') + '">' + ico(i[2]) + i[3] +
        (i[0] === 'cola' && n ? '<span class="badge" id="badgeCola">' + n + '</span>' : '') + '</a>';
    }).join('') + '</nav>';
  }
  function bandaRed() {
    var n = S.cola.length;
    if (!enLinea()) return '<div class="banda off">' + ico('sinred', 18, '#F5C518') + '<span>Sin señal' + (n ? ' · ' + n + ' registro(s) guardados en el teléfono. Se enviarán solos.' : '. Puedes seguir trabajando.') + '</span></div>';
    if (n) return '<a href="#/cola" class="banda cola">' + ico('sube', 18, '#F5C518') + '<span>' + (S.syncing ? 'Enviando ' : 'Por enviar: ') + n + ' registro(s)</span></a>';
    return '';
  }
  function actualizarBadges() {
    var b = document.getElementById('badgeCola');
    if (b) b.textContent = S.cola.length;
  }
  function refrescarVista() {
    var a = document.activeElement;
    if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
    if (/^(hoy|obra|cola|bodega)/.test(S.ruta)) render();
  }

  /* ============================================================ login */
  function vLogin() {
    if (!/^https?:\/\//.test(API)) {
      return '<div class="cuerpo" style="max-width:520px"><img src="logo.png" alt="MAC" style="width:160px;margin:20px auto"><div class="card"><h2>Falta configurar</h2>' +
        '<p>Abre el archivo <b>config.js</b> y pega la URL de la aplicación web de Apps Script.</p></div></div>';
    }
    var eq = S.equipo || [];
    var sel = S.tmp.loginId;
    var html = '<div class="cuerpo" style="max-width:520px"><img src="logo.png" alt="MAC Electricidad &amp; Construcción" style="width:170px;margin:18px auto 4px">' +
      '<div class="card"><h2>Ingresar</h2>';
    if (!eq.length) html += '<p class="muted">' + (enLinea() ? 'Cargando equipo…' : 'Necesitas señal para ingresar la primera vez.') + '</p>';
    else if (!sel) {
      html += '<p class="muted chico">Elige tu nombre</p><div class="lista">' + eq.map(function (t) {
        return '<button class="item" data-act="loginSel" data-id="' + esc(t.id) + '" style="border:0;border-bottom:1px solid #efede7;background:none;text-align:left;cursor:pointer">' +
          '<span class="avatar">' + esc(iniciales(t.nombre)) + '</span><span class="txt"><b>' + esc(t.nombre) + '</b><span class="muted chico">' + esc(t.cargo) + '</span></span></button>';
      }).join('') + '</div>';
    } else {
      var t = eq.filter(function (x) { return x.id === sel; })[0] || {};
      html += '<div class="item" style="border:0"><span class="avatar">' + esc(iniciales(t.nombre)) + '</span><span class="txt"><b>' + esc(t.nombre) + '</b><span class="muted chico">' + esc(t.cargo) + '</span></span>' +
        '<button class="btn lin" data-act="loginOtro">Cambiar</button></div>' +
        '<div class="campo"><label for="pin">PIN (4 números)</label><input id="pin" class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off"></div>' +
        '<button class="btn prim full grande" data-act="login">Entrar</button>';
    }
    return html + '</div></div>';
  }

  /* ============================================================ trabajador: hoy */
  function tarjetaObra(o, destacada) {
    var e = estadoObra(o), tot = (o.fotosReq || []).length;
    var pill = e.cierre ? (e.cierre.estado === 'Terminada' ? '<span class="pill ok">TERMINADA</span>' : '<span class="pill warn">' + esc(e.cierre.avance) + '%</span>')
      : (e.llegada ? '<span class="pill negra">EN CURSO</span>' : '<span class="pill">PENDIENTE</span>');
    return '<a class="card obra' + (destacada && e.llegada && !e.salida ? ' destacada' : '') + '" href="#/obra/' + esc(o.id) + '">' +
      '<div class="titulo"><div style="display:flex;flex-direction:column;gap:2px"><span class="nombre">' + esc(o.nombre) + '</span>' +
      '<span class="muted chico">' + esc([o.tipo, o.cotizacion ? 'COT ' + o.cotizacion : ''].filter(Boolean).join(' · ')) + '</span></div>' + pill + '</div>' +
      (o.direccion ? '<div class="muted chico" style="display:flex;gap:6px;align-items:center">' + ico('pin', 16) + esc(o.direccion) + '</div>' : '') +
      (tot ? '<div style="display:flex;flex-direction:column;gap:6px"><div class="titulo chico"><span>Fotos solicitadas</span><b>' + e.listas + ' de ' + tot + '</b></div>' +
        '<div class="barra"><div style="width:' + Math.round(100 * e.listas / tot) + '%"></div></div></div>' : '') + '</a>';
  }
  function vHoy() {
    var i = S.inicio, u = S.ses.user;
    var html = '<header class="top"><div class="fila"><span class="avatar">' + esc(iniciales(u.nombre)) + '</span><div style="flex:1"><div class="sub">' + esc(fechaLarga(hoyLocal())) + '</div>' +
      '<h1>Hola, ' + esc(u.nombre.split(' ')[0]) + '</h1></div></div>' + bandaRed() + '</header><main class="cuerpo">';
    if (!i) return html + '<div class="card"><p>' + (enLinea() ? 'Cargando tus obras…' : 'Sin señal y sin datos guardados. Abre la app con señal una vez.') + '</p></div></main>' + nav('hoy');
    if (i.hoy !== hoyLocal()) html += '<div class="card"><p class="chico muted">Mostrando datos del ' + esc(fechaCorta(i.hoy)) + '. Se actualizarán cuando haya señal.</p></div>';
    html += '<div class="titulo"><span class="h2">Mis obras de hoy</span><span class="muted">' + i.asignadas.length + ' asignada(s)</span></div>';
    html += i.asignadas.length ? i.asignadas.map(function (o) { return tarjetaObra(o, true); }).join('') :
      '<div class="card"><p class="muted">Hoy no tienes obras asignadas. Si estás trabajando en una, búscala abajo.</p></div>';
    if (i.otras && i.otras.length) {
      html += '<details class="card"><summary style="font-weight:700;cursor:pointer;min-height:32px">Otras obras activas (' + i.otras.length + ')</summary>' +
        '<div class="lista">' + i.otras.map(function (o) {
          return '<a class="item" href="#/obra/' + esc(o.id) + '" style="text-decoration:none"><span class="txt"><b>' + esc(o.nombre) + '</b><span class="muted chico">' + esc(o.cliente || '') + '</span></span>›</a>';
        }).join('') + '</div></details>';
    }
    return html + '</main>' + nav('hoy');
  }

  /* ============================================================ trabajador: obra */
  function cabeceraObra(o, sub, volverA) {
    return '<header class="top"><div class="fila"><a class="volver" href="' + volverA + '" aria-label="Volver">' + ico('volver') + '</a>' +
      '<div><h1>' + esc(o.nombre) + '</h1><div class="sub">' + esc(sub) + '</div></div></div>';
  }
  function vObra(id) {
    var o = obraPorId(id);
    if (!o) return '<main class="cuerpo"><div class="card"><p>Obra no encontrada.</p><a class="btn lin" href="#/hoy">Volver</a></div></main>' + nav('hoy');
    var e = estadoObra(o), hoy = hoyLocal();
    var html = cabeceraObra(o, [o.tipo, o.cotizacion ? 'COT ' + o.cotizacion : ''].filter(Boolean).join(' · '), '#/hoy');
    if (e.llegada) {
      html += '<div class="banda on">' + ico('pin', 20, '#9fd38a') + '<span><b>Llegada ' + hora(e.llegada.hora) + '</b>' +
        (e.llegada.gps ? ' · ' + esc(coords(e.llegada.gps)) : '') + (e.llegada.cola ? ' · por enviar' : '') + '</span></div>';
    }
    html += bandaRed() + '</header><main class="cuerpo">';
    if (o.notas) html += '<div class="card"><b>Indicaciones</b><span>' + esc(o.notas) + '</span></div>';
    if (!e.llegada) html += '<button class="btn prim full grande" data-act="llegada" data-id="' + esc(o.id) + '">' + ico('pin') + 'Marcar llegada a la obra</button>';

    var req = o.fotosReq || [];
    if (req.length) {
      html += '<div class="titulo"><span class="h2">Fotos solicitadas</span><b>' + e.listas + ' de ' + req.length + '</b></div><div class="card"><div class="lista">';
      var th = thumbs(), borr = borradas();
      req.forEach(function (it, n) {
        var t = th.filter(function (x) { return x.obraId === o.id && x.item === it && !borr[x.id]; })[0];
        var est = e.hechas[it] ? '<span class="muted chico" style="color:var(--ok)">Subida ✓</span>' : (e.enCola[it] ? '<span class="chico" style="color:var(--warn)">En el teléfono, por subir</span>' : '<span class="muted chico">Pendiente</span>');
        html += '<div class="item">' + (t ? '<img class="mini" src="' + t.thumb + '" alt="">' : '<span class="mini' + (e.hechas[it] ? '' : ' vacia') + '"></span>') +
          '<span class="txt"><b>' + esc(it) + '</b>' + est + '</span>' +
          '<button class="ico" data-act="fotoReq" data-id="' + esc(o.id) + '" data-n="' + n + '" aria-label="Tomar foto: ' + esc(it) + '">' + ico('cam') + '</button></div>';
      });
      html += '</div></div>';
    }
    html += '<div class="titulo"><span class="h2">Fotos de avance</span></div><div class="card">' +
      '<div class="campo"><label for="coment">Comentario (opcional)</label><input id="coment" type="text" placeholder="Ej: canalización sector cocina"></div>' +
      '<div class="grid2"><button class="btn neg" data-act="fotoAv" data-id="' + esc(o.id) + '" data-cam="1">' + ico('cam') + 'Cámara</button>' +
      '<button class="btn lin" data-act="fotoAv" data-id="' + esc(o.id) + '">' + ico('gal') + 'Galería</button></div></div>';

    var mf = misFotosObra(o);
    if (mf.length) {
      html += '<div class="titulo"><span class="h2">Mis fotos de hoy</span><span class="muted chico">' + mf.length + '</span></div><div class="card">' +
        '<p class="muted chico" style="margin:0">¿Subiste una foto por error? Bórrala aquí.</p><div class="mis-fotos">' + mf.map(function (f) {
          return '<figure><img src="' + esc(f.src) + '" alt="' + esc(f.item) + '"><figcaption><b>' + esc(f.item) + '</b><br>' + hora(f.hora) +
            (f.cola ? ' · <span style="color:var(--warn)">por subir</span>' : '') + '</figcaption>' +
            '<button class="borrar" data-act="borrarFoto" data-id="' + esc(f.id) + '" data-obra="' + esc(o.id) + '">Borrar</button></figure>';
        }).join('') + '</div></div>';
    }

    var mats = opsDe(o.id, 'material');
    html += '<div class="titulo"><span class="h2">Materiales de bodega</span></div><div class="card">' +
      '<p class="muted chico" style="margin:0">Registra lo que sacaste de la bodega para esta obra. Se descuenta del stock.</p>' +
      (mats.length ? '<div class="lista">' + mats.map(function (m) { return '<div class="item"><span class="txt"><b>' + esc(m.data.material) + '</b><span class="chico" style="color:var(--warn)">por enviar</span></span><b>' + esc(m.data.cantidad) + ' ' + esc(m.data.unidad) + '</b></div>'; }).join('') + '</div>' : '') +
      '<a class="btn punt full" href="#/material/' + esc(o.id) + '">' + ico('mas', 18) + 'Agregar material de la bodega</a></div>';

    if (e.salida) html += '<div class="card"><b>Salida registrada ' + hora(e.salida.hora) + '</b><span class="muted chico">' + (e.cierre ? esc(e.cierre.estado) + ' · ' + esc(e.cierre.avance) + '%' : '') + '</span></div>';
    else html += '<a class="btn neg full grande" href="#/cierre/' + esc(o.id) + '">Cerrar el día en esta obra ' + ico('reloj', 20, '#F5C518') + '</a>';
    return html + '</main>' + nav('hoy');
  }

  /* ============================================================ trabajador: material */
  function vMaterial(id) {
    var o = obraPorId(id), b = (S.inicio && S.inicio.bodega) || [];
    if (!o) return vObra(id);
    var q = (S.tmp.qMat || '').toLowerCase();
    var sel = S.tmp.matSel && b.filter(function (x) { return x.codigo === S.tmp.matSel; })[0];
    var html = cabeceraObra(o, 'Material sacado de bodega', '#/obra/' + o.id) + '</header><main class="cuerpo">';
    if (sel) {
      html += '<div class="card"><h2>' + esc(sel.material) + '</h2><span class="muted chico">Stock: ' + esc(sel.stock) + ' ' + esc(sel.unidad) + '</span>' +
        '<div class="campo"><label for="cant">Cantidad (' + esc(sel.unidad) + ')</label><input id="cant" type="number" inputmode="decimal" min="0" step="any"></div>' +
        '<div class="campo"><label for="nota">Nota (opcional)</label><input id="nota" type="text"></div>' +
        '<div class="grid2"><button class="btn lin" data-act="matCancel">Volver</button><button class="btn prim" data-act="matOk" data-id="' + esc(o.id) + '">Registrar</button></div></div>';
    } else {
      html += '<input id="qMat" type="search" placeholder="Buscar material…" value="' + esc(S.tmp.qMat || '') + '">' +
        '<div class="card"><div class="lista">' + b.filter(function (x) { return !q || (x.material + ' ' + x.categoria).toLowerCase().indexOf(q) >= 0; }).map(function (x) {
          return '<button class="item" data-act="matSel" data-cod="' + esc(x.codigo) + '" style="border:0;border-bottom:1px solid #efede7;background:none;text-align:left;cursor:pointer;width:100%">' +
            '<span class="txt"><b>' + esc(x.material) + '</b><span class="muted chico">' + esc(x.categoria) + '</span></span>' + estadoStock(x) + '</button>';
        }).join('') + '</div></div>';
    }
    return html + '</main>' + nav('hoy');
  }
  function estadoStock(x) {
    if (x.stock <= 0) return '<span class="pill mal">Sin stock</span>';
    if (x.stock <= x.minimo) return '<span class="pill warn">Quedan ' + x.stock + ' ' + esc(x.unidad) + '</span>';
    return '<span class="pill ok">' + x.stock + ' ' + esc(x.unidad) + '</span>';
  }

  /* ============================================================ trabajador: cierre */
  function vCierre(id) {
    var o = obraPorId(id);
    if (!o) return vObra(id);
    var c = S.tmp.cierre || (S.tmp.cierre = { estado: 'No terminada', avance: 50 });
    var html = cabeceraObra(o, 'Cierre del día · ' + fechaCorta(hoyLocal()), '#/obra/' + o.id) + '</header><main class="cuerpo">' +
      '<div class="card"><h2>¿Cómo quedó la obra?</h2><div class="seg">' +
      '<button data-act="cierreEstado" data-v="Terminada" aria-pressed="' + (c.estado === 'Terminada') + '">Terminada</button>' +
      '<button data-act="cierreEstado" data-v="No terminada" aria-pressed="' + (c.estado !== 'Terminada') + '">No terminada</button></div>' +
      (c.estado !== 'Terminada' ? '<div class="campo"><div class="titulo"><label for="avance">Avance de la obra</label><b id="avTxt">' + c.avance + ' %</b></div>' +
        '<input id="avance" type="range" min="0" max="100" step="5" value="' + c.avance + '"></div>' +
        '<div class="campo"><label for="motivo">¿Qué falta y por qué?</label><textarea id="motivo" rows="2">' + esc(c.motivo || '') + '</textarea></div>' : '') +
      '</div><div class="card"><div class="campo"><label for="tareas">Tareas realizadas hoy</label><textarea id="tareas" rows="3">' + esc(c.tareas || '') + '</textarea></div></div>' +
      '<button class="btn prim full grande" data-act="cerrar" data-id="' + esc(o.id) + '">' + ico('reloj') + 'Marcar salida y cerrar el día</button>' +
      '<p class="muted chico" style="text-align:center;margin:0">Se guarda la hora y la ubicación. Sin señal, se envía al recuperarla.</p>';
    return html + '</main>' + nav('hoy');
  }

  /* ============================================================ bodega (consulta) */
  function vBodega() {
    var b = (S.inicio && S.inicio.bodega) || [];
    var q = (S.tmp.qBod || '').toLowerCase(), cat = S.tmp.catBod || '';
    var cats = b.map(function (x) { return x.categoria; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).sort();
    var html = '<header class="top"><h1>Bodega</h1><div class="sub">Revisa qué hay disponible antes de salir a la obra</div>' + bandaRed() + '</header><main class="cuerpo">' +
      '<input id="qBod" type="search" placeholder="Buscar material…" value="' + esc(S.tmp.qBod || '') + '">' +
      '<div class="chips"><button class="chip" data-act="catBod" data-v="" aria-pressed="' + (!cat) + '">Todo</button>' +
      cats.map(function (c) { return '<button class="chip" data-act="catBod" data-v="' + esc(c) + '" aria-pressed="' + (cat === c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<div class="card"><div class="lista">' + (b.filter(function (x) {
        return (!cat || x.categoria === cat) && (!q || x.material.toLowerCase().indexOf(q) >= 0);
      }).map(function (x) {
        return '<div class="item"><span class="txt"><b>' + esc(x.material) + '</b><span class="muted chico">' + esc(x.categoria) + ' · ' + esc(x.codigo) + '</span></span>' + estadoStock(x) + '</div>';
      }).join('') || '<p class="muted">Sin resultados.</p>') + '</div></div>';
    return html + '</main>' + nav('bodega');
  }

  /* ============================================================ envíos pendientes */
  function vCola() {
    var nombres = { asistencia: 'Asistencia', foto: 'Foto', bitacora: 'Cierre del día', material: 'Material de bodega', borrarFoto: 'Borrar foto' };
    var html = '<header class="top"><h1>Envíos</h1><div class="sub">Lo que está guardado en el teléfono esperando señal</div>' + bandaRed() + '</header><main class="cuerpo">';
    if (!S.cola.length) html += '<div class="card"><p style="margin:0">' + ico('ok', 20, '#2f6b2f') + ' Todo está enviado.</p></div>';
    else {
      html += '<button class="btn prim full" data-act="sync">' + ico('sube') + 'Enviar ahora</button><div class="card"><div class="lista">' + S.cola.map(function (op) {
        var o = obraPorId(op.data.obraId);
        var det = op.kind === 'borrarFoto' ? 'por error' : op.kind === 'foto' ? (op.data.item || 'Avance') : (op.kind === 'asistencia' ? op.data.tipo : (op.kind === 'material' ? op.data.material + ' × ' + op.data.cantidad : op.data.estado));
        return '<div class="item"><span class="txt"><b>' + nombres[op.kind] + ' · ' + esc(det) + '</b><span class="muted chico">' + esc(o ? o.nombre : op.data.obraId) + ' · ' + fechaCorta(op.creado.substr(0, 10)) + ' ' + hora(op.creado) + '</span>' +
          (op.error ? '<span class="chico" style="color:var(--mal)">' + esc(op.error) + '</span>' : '') + '</span></div>';
      }).join('') + '</div></div>';
    }
    return html + '</main>' + nav('cola');
  }

  /* ============================================================ administración */
  function subnavAdmin(act) {
    var l = [['panel', '#/admin', 'Hoy'], ['plan', '#/admin/plan', 'Asignar'], ['obras', '#/admin/obras', 'Obras'], ['equipo', '#/admin/equipo', 'Equipo'], ['bod', '#/admin/bodega', 'Bodega']];
    return '<div class="subnav noimprimir">' + l.map(function (x) { return '<a href="' + x[1] + '" class="' + (act === x[0] ? 'act' : '') + '">' + x[2] + '</a>'; }).join('') + '</div>';
  }
  function cabAdmin(t) {
    return '<header class="top"><div class="fila"><img src="logo.png" alt="MAC" style="height:44px;background:#fff;border-radius:8px;padding:3px"><div><h1>' + esc(t) + '</h1><div class="sub">Panel de administración</div></div></div></header>';
  }
  function cargarAdmin(fecha, forzar) {
    fecha = fecha || S.adminFecha || hoyLocal();
    if (S.admin && S.adminFecha === fecha && !forzar) return Promise.resolve(S.admin);
    return apiSes({ action: 'admin', fecha: fecha }).then(function (r) {
      if (!r.ok) throw new Error(r.mensaje || r.error);
      S.admin = r; S.adminFecha = fecha; return r;
    });
  }
  function nombreT(id) { var t = (S.admin.trabajadores || []).filter(function (x) { return x.id === id; })[0]; return t ? t.nombre : id; }
  function nombreO(id) { var o = (S.admin.obras || []).filter(function (x) { return x.id === id; })[0]; return o ? o.nombre : id; }
  function necesitaAdmin(fn) {
    if (!S.admin) {
      cargarAdmin().then(render).catch(function (e) { toast(enLinea() ? e.message : 'El panel necesita señal'); });
      return '<main class="cuerpo"><div class="card"><p>' + (enLinea() ? 'Cargando panel…' : 'El panel de administración necesita señal.') + '</p></div></main>' + nav('admin');
    }
    return fn();
  }

  function vAdmin() {
    return necesitaAdmin(function () {
      var A = S.admin, f = S.adminFecha;
      var activas = A.obras.filter(function (o) { return o.estado !== 'Terminada'; });
      var trabAct = A.trabajadores.filter(function (t) { return t.activo === 'SI'; });
      var llegadas = A.asistencia.filter(function (a) { return a.tipo === 'LLEGADA'; });
      var html = cabAdmin('Registro de obras') + '<main class="cuerpo">' + subnavAdmin('panel') +
        '<div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap"><div class="campo"><label for="fAdm">Día</label><input id="fAdm" type="date" value="' + f + '"></div>' +
        '<button class="btn lin" data-act="admRefrescar">Actualizar</button></div>' +
        '<div class="kpis"><div class="kpi"><span class="muted chico">Obras activas</span><div class="n">' + activas.length + '</div></div>' +
        '<div class="kpi"><span class="muted chico">Marcaron llegada</span><div class="n">' + uniq(llegadas.map(function (a) { return a.trabajadorId; })).length + ' <span class="chico muted">de ' + trabAct.length + '</span></div></div>' +
        '<div class="kpi"><span class="muted chico">Fotos del día</span><div class="n">' + A.fotosDia + '</div></div>' +
        '<div class="kpi neg"><span class="chico">Cierres registrados</span><div class="n">' + A.bitacora.length + '</div></div></div>';

      html += '<div class="dos"><section class="card ancha"><h2>Obras</h2><div class="tabla"><table><thead><tr><th>Obra</th><th>Equipo del día</th><th>Fotos solicitadas</th><th>Cierre</th><th></th></tr></thead><tbody>' +
        activas.map(function (o) {
          var eq = A.asignaciones.filter(function (a) { return a.obraId === o.id; }).map(function (a) { return nombreT(a.trabajadorId).split(' ')[0]; });
          var b = A.bitacora.filter(function (x) { return x.obraId === o.id; }).slice(-1)[0];
          return '<tr><td><b>' + esc(o.nombre) + '</b><br><span class="muted chico">' + esc([o.cliente, o.cotizacion ? 'COT ' + o.cotizacion : ''].filter(Boolean).join(' · ')) + '</span></td>' +
            '<td>' + (esc(eq.join(', ')) || '<span class="muted">—</span>') + '</td><td>' + o.hechas + ' / ' + o.fotosReq.length + '</td>' +
            '<td>' + (b ? (b.estado === 'Terminada' ? '<span class="pill ok">Terminada</span>' : '<span class="pill warn">' + esc(b.avance) + '%</span>' + (b.motivo ? '<br><span class="chico muted">' + esc(b.motivo) + '</span>' : '')) : '<span class="muted">—</span>') + '</td>' +
            '<td><a href="#/informe/' + esc(o.id) + '" class="chico">Informe</a></td></tr>';
        }).join('') + '</tbody></table></div></section>';

      html += '<section class="card angosta"><h2>Asistencia</h2><div class="lista">' + trabAct.map(function (t) {
        var ll = A.asistencia.filter(function (a) { return a.trabajadorId === t.id && a.tipo === 'LLEGADA'; })[0];
        var sa = A.asistencia.filter(function (a) { return a.trabajadorId === t.id && a.tipo === 'SALIDA'; }).slice(-1)[0];
        return '<div class="item"><span class="txt"><b>' + esc(t.nombre) + '</b><span class="muted chico">' + (ll ? esc(nombreO(ll.obraId)) : '') + '</span></span>' +
          (ll ? '<span class="chico">' + hora(ll.hora) + ' → ' + (sa ? hora(sa.hora) : '—') + '</span>' + (ll.lat !== '' ? ' <a class="chico" target="_blank" rel="noopener" href="' + mapa(ll.lat, ll.lng) + '">mapa</a>' : '') : '<span class="chico" style="color:var(--mal)">Sin marcar</span>') + '</div>';
      }).join('') + '</div></section></div>';

      html += '<div class="dos"><section class="card ancha"><h2>Últimas fotos</h2><div class="galeria">' + (A.recientes.slice(0, 16).map(function (p) {
        return '<figure><a href="https://drive.google.com/file/d/' + esc(p.fileId) + '/view" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(p.url) + '" alt="' + esc(p.item || 'Avance') + '"></a>' +
          '<figcaption><b>' + esc(nombreO(p.obraId)) + '</b><br>' + esc(p.item || p.comentario || 'Avance') + ' · ' + fechaCorta(String(p.fecha)) + ' ' + hora(p.hora) + ' · ' + esc(nombreT(p.trabajadorId).split(' ')[0]) + '</figcaption>' +
          '<div class="acciones-foto"><a class="bajar" href="' + urlBajar(p.fileId) + '" target="_blank" rel="noopener">⬇ Descargar</a>' +
          '<button class="borrar" data-act="admBorrarFoto" data-id="' + esc(p.id) + '">Borrar</button></div></figure>';
      }).join('') || '<p class="muted">Aún no hay fotos.</p>') + '</div></section>';

      html += '<section class="card angosta"><h2>Salió de bodega</h2><div class="lista">' + (A.movimientos.filter(function (m) { return m.tipo === 'SALIDA'; }).map(function (m) {
        return '<div class="item"><span class="txt"><b>' + esc(m.material) + '</b><span class="muted chico">' + esc(m.obraId ? nombreO(m.obraId) : (m.nota || 'Sin obra')) + ' · ' + esc(nombreT(m.trabajadorId).split(' ')[0]) + '</span></span><b>' + esc(m.cantidad) + '</b></div>';
      }).join('') || '<p class="muted">Sin movimientos este día.</p>') + '</div></section></div>';
      return html + '</main>' + nav('admin');
    });
  }
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }

  function vAdmPlan() {
    return necesitaAdmin(function () {
      var A = S.admin, f = S.adminFecha;
      var activas = A.obras.filter(function (o) { return o.estado !== 'Terminada'; });
      var trab = A.trabajadores.filter(function (t) { return t.activo === 'SI'; });
      var plan = S.tmp.plan;
      if (!plan || plan.fecha !== f) {
        plan = S.tmp.plan = { fecha: f, m: {} };
        A.asignaciones.forEach(function (a) { (plan.m[a.obraId] = plan.m[a.obraId] || {})[a.trabajadorId] = true; });
      }
      var html = cabAdmin('Asignar trabajadores') + '<main class="cuerpo">' + subnavAdmin('plan') +
        '<div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap"><div class="campo"><label for="fAdm">Día</label><input id="fAdm" type="date" value="' + f + '"></div>' +
        '<button class="btn lin" data-act="planCopiar">Copiar del día anterior</button></div>';
      if (!activas.length) html += '<div class="card"><p>No hay obras activas. Crea una en <a href="#/admin/obras">Obras</a>.</p></div>';
      activas.forEach(function (o) {
        html += '<div class="card"><h2>' + esc(o.nombre) + '</h2><div class="chips">' + trab.map(function (t) {
          var on = plan.m[o.id] && plan.m[o.id][t.id];
          return '<button class="chip" data-act="planTog" data-o="' + esc(o.id) + '" data-t="' + esc(t.id) + '" aria-pressed="' + !!on + '">' + esc(t.nombre) + '</button>';
        }).join('') + '</div></div>';
      });
      return html + '<button class="btn prim full grande" data-act="planGuardar">Guardar asignación del ' + fechaCorta(f) + '</button></main>' + nav('admin');
    });
  }

  function vAdmObras() {
    return necesitaAdmin(function () {
      var filtro = S.tmp.fObras || 'Activa';
      var lista = S.admin.obras.filter(function (o) { return filtro === 'Todas' || o.estado === filtro; });
      return cabAdmin('Obras') + '<main class="cuerpo">' + subnavAdmin('obras') +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between"><div class="chips">' + ['Activa', 'Pausada', 'Terminada', 'Todas'].map(function (x) {
          return '<button class="chip" data-act="fObras" data-v="' + x + '" aria-pressed="' + (filtro === x) + '">' + x + (x === 'Todas' ? '' : 's') + '</button>';
        }).join('') + '</div><a class="btn neg" href="#/admin/obra/nueva">+ Nueva obra</a></div>' +
        '<div class="card"><div class="lista">' + (lista.map(function (o) {
          return '<div class="item"><span class="txt"><b>' + esc(o.nombre) + '</b><span class="muted chico">' + esc([o.id, o.cliente, o.cotizacion ? 'COT ' + o.cotizacion : '', o.tipo].filter(Boolean).join(' · ')) +
            ' · fotos ' + o.hechas + '/' + o.fotosReq.length + ' · ' + o.totalFotos + ' en total</span></span>' +
            '<a class="btn lin" href="#/informe/' + esc(o.id) + '">Informe / Fotos</a><a class="btn lin" href="#/admin/obra/' + esc(o.id) + '">Editar</a></div>';
        }).join('') || '<p class="muted">No hay obras.</p>') + '</div></div></main>' + nav('admin');
    });
  }

  function vAdmObra(id) {
    return necesitaAdmin(function () {
      var o = id === 'nueva' ? { estado: 'Activa', fotosReq: [], fechaInicio: hoyLocal() } : S.admin.obras.filter(function (x) { return x.id === id; })[0];
      if (!o) return '<main class="cuerpo"><p>No existe.</p></main>';
      var tipos = Object.keys(S.admin.plantillas);
      var f = function (k, lab, tipo) { return '<div class="campo"><label for="o_' + k + '">' + lab + '</label><input id="o_' + k + '" type="' + (tipo || 'text') + '" value="' + esc(o[k] || '') + '"></div>'; };
      return cabAdmin(id === 'nueva' ? 'Nueva obra' : 'Editar obra') + '<main class="cuerpo" style="max-width:760px">' + subnavAdmin('obras') +
        '<div class="card">' + f('nombre', 'Nombre de la obra *') + f('cliente', 'Cliente') +
        '<div class="grid2">' + f('cotizacion', 'N° cotización') + f('fechaInicio', 'Fecha de inicio', 'date') + '</div>' + f('direccion', 'Dirección / ubicación') +
        '<div class="grid2"><div class="campo"><label for="o_tipo">Tipo de trabajo</label><select id="o_tipo"><option value=""></option>' + tipos.map(function (t) {
          return '<option' + (o.tipo === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label for="o_estado">Estado</label><select id="o_estado">' + ['Activa', 'Pausada', 'Terminada'].map(function (t) {
          return '<option' + (o.estado === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="campo"><label for="o_notas">Indicaciones para el equipo</label><textarea id="o_notas" rows="2">' + esc(o.notas || '') + '</textarea></div></div>' +
        '<div class="card"><div class="titulo"><h2>Fotos solicitadas</h2><button class="btn lin" data-act="cargarPlantilla">Usar lista del tipo de trabajo</button></div>' +
        '<label for="o_fotos" class="muted chico">Una foto por línea</label><textarea id="o_fotos" rows="8">' + esc((o.fotosReq || []).join('\n')) + '</textarea>' +
        '<button class="btn lin" data-act="guardarPlantilla">Guardar esta lista como plantilla</button></div>' +
        '<button class="btn prim full grande" data-act="guardarObra" data-id="' + esc(o.id || '') + '">Guardar obra</button></main>' + nav('admin');
    });
  }

  function vAdmEquipo() {
    return necesitaAdmin(function () {
      var ed = S.tmp.editT;
      var t = ed === 'nuevo' ? { rol: 'trabajador', activo: 'SI', pin: String(Math.floor(1000 + Math.random() * 9000)) } : S.admin.trabajadores.filter(function (x) { return x.id === ed; })[0];
      var html = cabAdmin('Equipo') + '<main class="cuerpo" style="max-width:860px">' + subnavAdmin('equipo');
      if (t) {
        html += '<div class="card"><h2>' + (ed === 'nuevo' ? 'Nuevo trabajador' : 'Editar ' + esc(t.nombre)) + '</h2>' +
          '<div class="campo"><label for="t_nombre">Nombre *</label><input id="t_nombre" type="text" value="' + esc(t.nombre || '') + '"></div>' +
          '<div class="grid2"><div class="campo"><label for="t_cargo">Cargo</label><input id="t_cargo" type="text" value="' + esc(t.cargo || '') + '" placeholder="Electricista, ayudante…"></div>' +
          '<div class="campo"><label for="t_tel">Teléfono</label><input id="t_tel" type="tel" value="' + esc(t.telefono || '') + '"></div></div>' +
          '<div class="grid2"><div class="campo"><label for="t_pin">PIN (4 números)</label><input id="t_pin" type="text" inputmode="numeric" maxlength="4" value="' + esc(t.pin || '') + '"></div>' +
          '<div class="campo"><label for="t_rol">Permisos</label><select id="t_rol"><option value="trabajador"' + (t.rol !== 'admin' ? ' selected' : '') + '>Trabajador</option><option value="admin"' + (t.rol === 'admin' ? ' selected' : '') + '>Administrador</option></select></div></div>' +
          '<div class="campo"><label for="t_act">Estado</label><select id="t_act"><option value="SI"' + (t.activo !== 'NO' ? ' selected' : '') + '>Activo</option><option value="NO"' + (t.activo === 'NO' ? ' selected' : '') + '>Retirado (sin acceso)</option></select></div>' +
          '<div class="grid2"><button class="btn lin" data-act="tCancel">Cancelar</button><button class="btn prim" data-act="tGuardar" data-id="' + esc(t.id || '') + '">Guardar</button></div></div>';
      } else html += '<button class="btn neg" data-act="tEditar" data-id="nuevo">+ Agregar trabajador</button>';
      html += '<div class="card"><div class="lista">' + S.admin.trabajadores.map(function (x) {
        return '<div class="item"><span class="avatar" style="' + (x.activo === 'NO' ? 'background:#ddd;color:#777' : '') + '">' + esc(iniciales(x.nombre)) + '</span><span class="txt"><b>' + esc(x.nombre) + '</b>' +
          '<span class="muted chico">' + esc(x.cargo || '') + (x.rol === 'admin' ? ' · Administrador' : '') + ' · PIN ' + esc(x.pin) + (x.activo === 'NO' ? ' · RETIRADO' : '') + '</span></span>' +
          '<button class="btn lin" data-act="tEditar" data-id="' + esc(x.id) + '">Editar</button></div>';
      }).join('') + '</div></div></main>' + nav('admin');
      return html;
    });
  }

  function vAdmBodega() {
    return necesitaAdmin(function () {
      var b = S.admin.bodega, ed = S.tmp.editM;
      var m = ed === 'nuevo' ? { unidad: 'un', stock: 0, minimo: 0 } : b.filter(function (x) { return x.codigo === ed; })[0];
      var html = cabAdmin('Bodega') + '<main class="cuerpo" style="max-width:960px">' + subnavAdmin('bod');
      if (m) {
        html += '<div class="card"><h2>' + (ed === 'nuevo' ? 'Nuevo material' : esc(m.material)) + '</h2>' +
          '<div class="campo"><label for="m_mat">Material *</label><input id="m_mat" type="text" value="' + esc(m.material || '') + '"></div>' +
          '<div class="grid2"><div class="campo"><label for="m_cat">Categoría</label><input id="m_cat" type="text" list="cats" value="' + esc(m.categoria || '') + '"><datalist id="cats">' +
          uniq(b.map(function (x) { return x.categoria; })).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div>' +
          '<div class="campo"><label for="m_uni">Unidad</label><input id="m_uni" type="text" value="' + esc(m.unidad || '') + '" placeholder="un, m, kg, rollo…"></div></div>' +
          '<div class="grid2">' + (ed === 'nuevo' ? '<div class="campo"><label for="m_stock">Stock inicial</label><input id="m_stock" type="number" value="0"></div>' : '<div class="campo"><label>Stock actual</label><b style="font-size:22px">' + esc(m.stock) + '</b></div>') +
          '<div class="campo"><label for="m_min">Aviso "quedan pocas" bajo</label><input id="m_min" type="number" value="' + esc(m.minimo || 0) + '"></div></div>' +
          '<div class="grid2"><button class="btn lin" data-act="mCancel">Cancelar</button><button class="btn prim" data-act="mGuardar" data-cod="' + esc(m.codigo || '') + '">Guardar</button></div></div>';
      } else html += '<button class="btn neg" data-act="mEditar" data-cod="nuevo">+ Agregar material</button>';
      var sal = !m && S.tmp.salida && b.filter(function (x) { return x.codigo === S.tmp.salida; })[0];
      if (sal) {
        html += '<div class="card destacada"><h2>Salida de bodega – ' + esc(sal.material) + '</h2>' +
          '<p class="muted chico">Para material que sale sin ir a una obra (ventas, uso interno, pérdidas). Stock actual: <b>' + esc(sal.stock) + ' ' + esc(sal.unidad) + '</b></p>' +
          '<div class="grid2"><div class="campo"><label for="s_cant">Cantidad (' + esc(sal.unidad) + ') *</label><input id="s_cant" type="number" inputmode="decimal" min="0"></div>' +
          '<div class="campo"><label for="s_mot">Motivo *</label><select id="s_mot">' +
          ['Venta Mercado Libre', 'Venta a contratista', 'Venta directa', 'Uso interno / taller', 'Pérdida o daño', 'Otro'].map(function (o) { return '<option>' + o + '</option>'; }).join('') +
          '</select></div></div>' +
          '<div class="campo"><label for="s_det">Detalle (opcional)</label><input id="s_det" type="text" placeholder="N° de venta, empresa, boleta…"></div>' +
          '<div class="grid2"><button class="btn lin" data-act="mSalCancel">Cancelar</button><button class="btn prim" data-act="mSalOk" data-cod="' + esc(sal.codigo) + '">Descontar</button></div></div>';
      }
      html += '<div class="card"><div class="tabla"><table><thead><tr><th>Código</th><th>Material</th><th>Categoría</th><th>Stock</th><th></th></tr></thead><tbody>' + b.map(function (x) {
        return '<tr><td>' + esc(x.codigo) + '</td><td><b>' + esc(x.material) + '</b></td><td>' + esc(x.categoria) + '</td><td>' + estadoStock(x) + '</td>' +
          '<td style="white-space:nowrap"><button class="btn lin" data-act="mMov" data-cod="' + esc(x.codigo) + '" data-tipo="INGRESO">+ Ingreso</button> ' +
          '<button class="btn lin" data-act="mSalida" data-cod="' + esc(x.codigo) + '">− Salida</button> ' +
          '<button class="btn lin" data-act="mMov" data-cod="' + esc(x.codigo) + '" data-tipo="AJUSTE">Inventario</button> ' +
          '<button class="btn lin" data-act="mEditar" data-cod="' + esc(x.codigo) + '">Editar</button></td></tr>';
      }).join('') + '</tbody></table></div><p class="muted chico">"− Salida" = material que sale sin ir a una obra (venta Mercado Libre, contratista, uso interno, pérdida).<br>"Inventario" = escribir la cantidad contada en bodega (el sistema guarda la diferencia).</p></div></main>' + nav('admin');
      return html;
    });
  }

  function urlBajar(fileId) { return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(fileId || ''); }
  function bloqueDescarga(d, dias) {
    var z = S.tmp.zip && S.tmp.zip.obraId === d.obra.id ? S.tmp.zip : null;
    var h = '<section class="card noimprimir descarga"><h2>Descargar fotos</h2>';
    if (!d.fotos.length) return h + '<p class="muted">Esta obra aún no tiene fotos.</p></section>';
    h += '<p class="muted chico">Se arma un archivo ZIP con las fotos originales (con fecha, hora, GPS y nombre del trabajador estampados), ordenadas en carpetas por día.</p>' +
      '<div class="fila-desc"><select id="zDia"><option value="">Todos los días (' + d.fotos.length + ' fotos)</option>' + dias.map(function (x) {
        var n = d.fotos.filter(function (f) { return String(f.fecha) === x; }).length;
        return n ? '<option value="' + esc(x) + '"' + (z && z.fecha === x ? ' selected' : '') + '>' + fechaCorta(x) + ' (' + n + ' fotos)</option>' : '';
      }).join('') + '</select><button class="btn neg" data-act="zipFotos" data-id="' + esc(d.obra.id) + '">⬇ Descargar ZIP</button>' +
      (d.obra.carpetaId ? '<a class="btn lin" href="https://drive.google.com/drive/folders/' + esc(d.obra.carpetaId) + '" target="_blank" rel="noopener">Abrir carpeta en Drive</a>' : '') + '</div>';
    if (z && z.cargando) h += '<p><b>Preparando el ZIP…</b> <span class="muted">puede tardar hasta un par de minutos si son muchas fotos.</span></p>';
    if (z && z.partes) {
      h += '<div class="lista">' + z.partes.map(function (p, i) {
        return '<div class="item"><span class="txt"><b>' + esc(p.nombre) + '</b><span class="muted chico">' + p.fotos + ' fotos' + (z.partes.length > 1 ? ' · parte ' + (i + 1) + ' de ' + z.partes.length : '') + '</span></span>' +
          '<a class="btn prim" href="' + esc(p.url) + '" target="_blank" rel="noopener">Bajar</a></div>';
      }).join('') + '</div>' + (z.faltan ? '<p class="muted chico">' + z.faltan + ' foto(s) no se encontraron en Drive.</p>' : '') +
      '<p class="muted chico">El ZIP queda disponible 2 días; después se borra solo (las fotos originales siguen en Drive).</p>';
    }
    return h + '</section>';
  }
  function vInforme(id) {
    var d = S.tmp.informe;
    if (!d || d.obra.id !== id) {
      apiSes({ action: 'informe', obraId: id }).then(function (r) { if (!r.ok) throw new Error(r.mensaje); S.tmp.informe = r; render(); })
        .catch(function (e) { toast(e.message || 'Necesita señal'); });
      return '<main class="cuerpo"><div class="card"><p>Preparando informe…</p></div></main>' + nav('admin');
    }
    var o = d.obra;
    var dias = uniq(d.fotos.map(function (f) { return String(f.fecha); }).concat(d.bitacora.map(function (b) { return String(b.fecha); }))).sort();
    var html = '<div class="noimprimir" style="padding:12px 16px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn lin" href="#/admin/obras">← Volver</a>' +
      '<button class="btn prim" data-act="imprimir">Imprimir / Guardar PDF</button></div>' + bloqueDescarga(d, dias) + '<article class="informe">' +
      '<header><img src="logo.png" alt="MAC"><div><h1>Informe fotográfico de obra</h1><div class="muted">' + esc(d.empresa || CFG.EMPRESA || '') + '</div></div></header>' +
      '<table><tbody><tr><th>Obra</th><td>' + esc(o.nombre) + '</td><th>Cliente</th><td>' + esc(o.cliente || '') + '</td></tr>' +
      '<tr><th>Cotización</th><td>' + esc(o.cotizacion || '') + '</td><th>Dirección</th><td>' + esc(o.direccion || '') + '</td></tr>' +
      '<tr><th>Período</th><td>' + (dias.length ? fechaCorta(dias[0]) + ' al ' + fechaCorta(dias[dias.length - 1]) : '—') + '</td><th>Estado</th><td>' + esc(o.estado || '') + '</td></tr></tbody></table>';
    if (d.bitacora.length) {
      html += '<h3>Bitácora</h3><table><thead><tr><th>Fecha</th><th>Trabajador</th><th>Estado</th><th>Tareas / observaciones</th></tr></thead><tbody>' + d.bitacora.map(function (b) {
        return '<tr><td>' + fechaCorta(String(b.fecha)) + '</td><td>' + esc(b.trabajador) + '</td><td>' + esc(b.estado) + (b.estado !== 'Terminada' ? ' (' + esc(b.avance) + '%)' : '') + '</td><td>' + esc(b.tareas) + (b.motivo ? '<br><i>' + esc(b.motivo) + '</i>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>';
    }
    if (d.materiales.length) {
      html += '<h3>Materiales de bodega utilizados</h3><table><thead><tr><th>Fecha</th><th>Material</th><th>Cantidad</th><th>Retiró</th></tr></thead><tbody>' + d.materiales.filter(function (m) { return m.tipo === 'SALIDA'; }).map(function (m) {
        return '<tr><td>' + fechaCorta(String(m.fechaHora).substr(0, 10)) + '</td><td>' + esc(m.material) + '</td><td>' + esc(m.cantidad) + '</td><td>' + esc(m.trabajador) + '</td></tr>';
      }).join('') + '</tbody></table>';
    }
    html += '<h3>Registro fotográfico (' + d.fotos.length + ')</h3><div class="inf-fotos">' + d.fotos.map(function (f) {
      return '<figure><img src="' + esc(f.url) + '" alt="' + esc(f.item || 'Avance') + '"><a class="bajar noimprimir" href="' + urlBajar(f.fileId) + '" target="_blank" rel="noopener">⬇ Descargar foto</a><figcaption><b>' + esc(f.item || 'Avance') + '</b>' + (f.comentario ? ' – ' + esc(f.comentario) : '') + '<br>' +
        fechaCorta(String(f.fecha)) + ' ' + hora(f.hora) + ' · ' + esc(f.trabajador) + (f.lat !== '' ? ' · ' + esc(coords(f)) : '') + '</figcaption></figure>';
    }).join('') + '</div></article>';
    return html;
  }

  /* ============================================================ acciones */
  var ACT = {
    loginSel: function (el) { S.tmp.loginId = el.dataset.id; render(); setTimeout(function () { var p = document.getElementById('pin'); if (p) p.focus(); }, 50); },
    loginOtro: function () { S.tmp.loginId = null; render(); },
    login: function (el) {
      var pin = document.getElementById('pin').value.trim();
      if (!/^\d{4}$/.test(pin)) return toast('El PIN tiene 4 números');
      el.classList.add('cargando');
      api({ action: 'login', trabajadorId: S.tmp.loginId, pin: pin }).then(function (r) {
        if (!r.ok) { el.classList.remove('cargando'); return toast(r.mensaje || 'No se pudo ingresar'); }
        S.ses = { token: r.token, user: r.user }; guardar('ses', S.ses); S.tmp = {};
        // registros guardados de este mismo trabajador quedan con su sesión nueva
        return Promise.all(S.cola.filter(function (op) { return op.userId === r.user.id; }).map(function (op) { op.token = r.token; op.error = null; return cola.poner(op); }))
          .then(leerCola).then(cargarInicio).then(function () { location.hash = '#/hoy'; render(); sincronizar(); });
      }).catch(function () { el.classList.remove('cargando'); toast('Sin conexión con el servidor'); });
    },
    llegada: function (el) {
      var o = obraPorId(el.dataset.id); el.classList.add('cargando'); toast('Obteniendo ubicación…');
      obtenerGPS().then(function (g) {
        var iso = isoLocal(new Date());
        return encolar('asistencia', { fecha: iso.substr(0, 10), obraId: o.id, tipo: 'LLEGADA', hora: iso, lat: g ? g.lat : '', lng: g ? g.lng : '', precision: g ? g.precision : '' });
      }).then(function () { toast('Llegada registrada'); render(); });
    },
    fotoReq: function (el) { var o = obraPorId(el.dataset.id); tomarFoto(o, { camara: true, item: o.fotosReq[Number(el.dataset.n)] }); },
    fotoAv: function (el) { var o = obraPorId(el.dataset.id); var c = document.getElementById('coment'); tomarFoto(o, { camara: !!el.dataset.cam, comentario: c ? c.value.trim() : '' }); },
    matSel: function (el) { S.tmp.matSel = el.dataset.cod; render(); setTimeout(function () { var c = document.getElementById('cant'); if (c) c.focus(); }, 50); },
    matCancel: function () { S.tmp.matSel = null; render(); },
    matOk: function (el) {
      var b = S.inicio.bodega.filter(function (x) { return x.codigo === S.tmp.matSel; })[0];
      var cant = num(document.getElementById('cant').value);
      if (!(cant > 0)) return toast('Escribe la cantidad');
      encolar('material', { obraId: el.dataset.id, codigo: b.codigo, material: b.material, unidad: b.unidad, cantidad: cant, nota: document.getElementById('nota').value.trim(), hora: isoLocal(new Date()) })
        .then(function () { b.stock -= cant; guardar('inicio', S.inicio); S.tmp.matSel = null; S.tmp.qMat = ''; toast('Material registrado'); location.hash = '#/obra/' + el.dataset.id; });
    },
    cierreEstado: function (el) { leerCierre(); S.tmp.cierre.estado = el.dataset.v; render(); },
    cerrar: function (el) {
      leerCierre();
      var c = S.tmp.cierre, o = obraPorId(el.dataset.id);
      if (c.estado !== 'Terminada' && !String(c.motivo || '').trim()) return toast('Indica qué falta y por qué');
      el.classList.add('cargando'); toast('Obteniendo ubicación…');
      obtenerGPS().then(function (g) {
        var iso = isoLocal(new Date());
        return encolar('bitacora', { fecha: iso.substr(0, 10), obraId: o.id, estado: c.estado, avance: c.estado === 'Terminada' ? 100 : c.avance, motivo: c.motivo || '', tareas: c.tareas || '' })
          .then(function () { return encolar('asistencia', { fecha: iso.substr(0, 10), obraId: o.id, tipo: 'SALIDA', hora: iso, lat: g ? g.lat : '', lng: g ? g.lng : '', precision: g ? g.precision : '' }); });
      }).then(function () { S.tmp.cierre = null; toast('Día cerrado. ¡Buen trabajo!'); location.hash = '#/hoy'; });
    },
    catBod: function (el) { S.tmp.catBod = el.dataset.v; render(); },
    sync: function () { if (!enLinea()) return toast('Sin señal por ahora'); sincronizar(); render(); },
    imprimir: function () { window.print(); },
    borrarFoto: function (el) {
      var id = el.dataset.id;
      if (!confirm('¿Borrar esta foto? Usa esto solo si se subió por error.')) return;
      var op = S.cola.filter(function (x) { return x.id === id; })[0];
      quitarThumb(id); marcarBorrada(id);
      if (op) { cola.quitar(id).then(leerCola).then(function () { toast('Foto borrada'); render(); }); return; }
      encolar('borrarFoto', { fotoId: id, obraId: el.dataset.obra }).then(function () {
        toast(enLinea() ? 'Foto borrada' : 'Se borrará cuando vuelva la señal'); render();
      });
    },
    admBorrarFoto: function (el) {
      if (!confirm('¿Borrar esta foto? Queda en la papelera de Drive por 30 días.')) return;
      apiSes({ action: 'borrarFoto', fotoId: el.dataset.id }).then(function (r) {
        if (!r.ok) return toast(r.mensaje || 'Error');
        toast('Foto borrada'); return cargarAdmin(S.adminFecha, true).then(render);
      }).catch(function (e) { toast(e.message || 'Necesita señal'); });
    },

    admRefrescar: function () { var f = document.getElementById('fAdm').value || hoyLocal(); cargarAdmin(f, true).then(render).catch(function (e) { toast(e.message); }); },
    planTog: function (el) { var m = S.tmp.plan.m; (m[el.dataset.o] = m[el.dataset.o] || {}); m[el.dataset.o][el.dataset.t] = !m[el.dataset.o][el.dataset.t]; el.setAttribute('aria-pressed', !!m[el.dataset.o][el.dataset.t]); },
    planCopiar: function () {
      var d = new Date(S.adminFecha + 'T12:00:00'); d.setDate(d.getDate() - 1);
      var ant = isoLocal(d).substr(0, 10), destino = S.adminFecha;
      apiSes({ action: 'admin', fecha: ant }).then(function (r) {
        var m = {}; r.asignaciones.forEach(function (a) { (m[a.obraId] = m[a.obraId] || {})[a.trabajadorId] = true; });
        S.tmp.plan = { fecha: destino, m: m }; toast('Copiado del ' + fechaCorta(ant) + '. Revisa y guarda.'); render();
      }).catch(function () { toast('Necesita señal'); });
    },
    planGuardar: function (el) {
      var m = S.tmp.plan.m, lista = Object.keys(m).map(function (o) { return { obraId: o, trabajadorIds: Object.keys(m[o]).filter(function (t) { return m[o][t]; }) }; });
      el.classList.add('cargando');
      apiSes({ action: 'guardarAsignaciones', fecha: S.adminFecha, asignaciones: lista }).then(function (r) {
        el.classList.remove('cargando'); if (!r.ok) return toast(r.mensaje || 'Error');
        toast('Asignación guardada'); S.tmp.plan = null; return cargarAdmin(S.adminFecha, true).then(render);
      }).catch(function (e) { el.classList.remove('cargando'); toast(e.message || 'Necesita señal'); });
    },
    fObras: function (el) { S.tmp.fObras = el.dataset.v; render(); },
    cargarPlantilla: function () {
      var t = document.getElementById('o_tipo').value, p = S.admin.plantillas[t];
      if (!p) return toast('Elige primero el tipo de trabajo');
      var ta = document.getElementById('o_fotos');
      ta.value = uniq(ta.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).concat(p)).join('\n');
    },
    guardarPlantilla: function () {
      var nombre = prompt('Nombre de la plantilla (ej: Empalme trifásico):', document.getElementById('o_tipo').value || '');
      if (!nombre) return;
      var items = document.getElementById('o_fotos').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      apiSes({ action: 'guardarPlantilla', tipo: nombre.trim(), items: items }).then(function (r) {
        if (!r.ok) return toast(r.mensaje); S.admin.plantillas[nombre.trim()] = items; toast('Plantilla guardada');
      }).catch(function () { toast('Necesita señal'); });
    },
    guardarObra: function (el) {
      var g = function (k) { return document.getElementById('o_' + k).value.trim(); };
      var o = { id: el.dataset.id || null, nombre: g('nombre'), cliente: g('cliente'), cotizacion: g('cotizacion'), fechaInicio: g('fechaInicio'), direccion: g('direccion'),
        tipo: g('tipo'), estado: g('estado'), notas: g('notas'), fotosReq: g('fotos').split('\n').map(function (x) { return x.trim(); }).filter(Boolean) };
      if (!o.nombre) return toast('Falta el nombre de la obra');
      el.classList.add('cargando');
      apiSes({ action: 'guardarObra', o: o }).then(function (r) {
        el.classList.remove('cargando'); if (!r.ok) return toast(r.mensaje || 'Error');
        toast('Obra guardada'); return cargarAdmin(S.adminFecha, true).then(function () { location.hash = '#/admin/obras'; });
      }).catch(function (e) { el.classList.remove('cargando'); toast(e.message || 'Necesita señal'); });
    },
    tEditar: function (el) { S.tmp.editT = el.dataset.id; render(); window.scrollTo(0, 0); },
    tCancel: function () { S.tmp.editT = null; render(); },
    tGuardar: function (el) {
      var g = function (k) { return document.getElementById('t_' + k).value.trim(); };
      var t = { id: el.dataset.id || null, nombre: g('nombre'), cargo: g('cargo'), telefono: g('tel'), pin: g('pin'), rol: g('rol'), activo: g('act') };
      if (!t.nombre) return toast('Falta el nombre');
      if (!/^\d{4}$/.test(t.pin)) return toast('El PIN debe tener 4 números');
      apiSes({ action: 'guardarTrabajador', t: t }).then(function (r) {
        if (!r.ok) return toast(r.mensaje || 'Error');
        toast('Guardado'); S.tmp.editT = null; return cargarAdmin(S.adminFecha, true).then(render);
      }).catch(function (e) { toast(e.message || 'Necesita señal'); });
    },
    mEditar: function (el) { S.tmp.editM = el.dataset.cod; render(); window.scrollTo(0, 0); },
    mCancel: function () { S.tmp.editM = null; render(); },
    mGuardar: function (el) {
      var g = function (k) { var x = document.getElementById('m_' + k); return x ? x.value.trim() : ''; };
      var m = { codigo: el.dataset.cod || null, material: g('mat'), categoria: g('cat'), unidad: g('uni'), minimo: num(g('min')), stock: num(g('stock')) };
      if (!m.material) return toast('Falta el nombre del material');
      apiSes({ action: 'guardarMaterial', m: m }).then(function (r) {
        if (!r.ok) return toast(r.mensaje || 'Error');
        toast('Material guardado'); S.tmp.editM = null; return cargarAdmin(S.adminFecha, true).then(render);
      }).catch(function (e) { toast(e.message || 'Necesita señal'); });
    },
    zipFotos: function (el) {
      var id = el.dataset.id, dia = (document.getElementById('zDia') || {}).value || '';
      S.tmp.zip = { obraId: id, fecha: dia, cargando: true }; render();
      apiSes({ action: 'descargarFotos', obraId: id, fecha: dia }, 330000).then(function (r) {
        if (!r.ok) { S.tmp.zip = null; render(); return toast(r.mensaje || 'Error'); }
        S.tmp.zip = { obraId: id, fecha: dia, partes: r.partes, faltan: r.faltan }; render();
        toast(r.partes.length > 1 ? 'Listo: ' + r.total + ' fotos en ' + r.partes.length + ' partes' : 'Listo: ' + r.total + ' fotos');
      }).catch(function (e) { S.tmp.zip = null; render(); toast(e.name === 'AbortError' ? 'Tardó demasiado. Prueba descargando por día.' : (e.message || 'Necesita señal')); });
    },
    mSalida: function (el) { S.tmp.salida = el.dataset.cod; S.tmp.editM = null; render(); window.scrollTo(0, 0); setTimeout(function () { var c = document.getElementById('s_cant'); if (c) c.focus(); }, 50); },
    mSalCancel: function () { S.tmp.salida = null; render(); },
    mSalOk: function (el) {
      var x = S.admin.bodega.filter(function (b) { return b.codigo === el.dataset.cod; })[0];
      var cant = num(document.getElementById('s_cant').value), mot = document.getElementById('s_mot').value, det = document.getElementById('s_det').value.trim();
      if (!(cant > 0)) return toast('Escribe la cantidad que sale');
      if (cant > Number(x.stock) && !confirm('En el sistema hay ' + x.stock + ' ' + x.unidad + ' y vas a sacar ' + cant + '. El stock quedará negativo. ¿Continuar?')) return;
      el.disabled = true;
      apiSes({ action: 'movimientoBodega', m: { codigo: x.codigo, tipo: 'SALIDA', cantidad: cant, nota: mot + (det ? ' – ' + det : '') } }).then(function (r) {
        el.disabled = false;
        if (!r.ok) return toast(r.mensaje || 'Error');
        toast('Descontado. Quedan ' + r.stock + ' ' + x.unidad); S.tmp.salida = null; return cargarAdmin(S.adminFecha, true).then(render);
      }).catch(function (e) { el.disabled = false; toast(e.message || 'Necesita señal'); });
    },
    mMov: function (el) {
      var x = S.admin.bodega.filter(function (b) { return b.codigo === el.dataset.cod; })[0], tipo = el.dataset.tipo;
      var v = prompt(tipo === 'INGRESO' ? 'Cantidad que ingresa a bodega (' + x.unidad + ') – ' + x.material : 'Cantidad contada en bodega (' + x.unidad + ') – ' + x.material + '\nStock actual en sistema: ' + x.stock);
      if (v === null || v === '') return;
      apiSes({ action: 'movimientoBodega', m: { codigo: x.codigo, tipo: tipo, cantidad: num(v) } }).then(function (r) {
        if (!r.ok) return toast(r.mensaje || 'Error'); toast('Stock actualizado: ' + r.stock + ' ' + x.unidad); return cargarAdmin(S.adminFecha, true).then(render);
      }).catch(function (e) { toast(e.message || 'Necesita señal'); });
    }
  };
  function leerCierre() {
    var c = S.tmp.cierre || (S.tmp.cierre = { estado: 'No terminada', avance: 50 });
    var a = document.getElementById('avance'), m = document.getElementById('motivo'), t = document.getElementById('tareas');
    if (a) c.avance = Number(a.value); if (m) c.motivo = m.value; if (t) c.tareas = t.value;
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (el && ACT[el.dataset.act]) { e.preventDefault(); ACT[el.dataset.act](el, e); }
  });
  document.addEventListener('input', function (e) {
    var id = e.target.id;
    if (id === 'qBod' || id === 'qMat') {
      S.tmp[id] = e.target.value; var pos = e.target.selectionStart;
      render(); var n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* */ } }
    }
    if (id === 'avance') { var t = document.getElementById('avTxt'); if (t) t.textContent = e.target.value + ' %'; }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'fAdm') { S.tmp.plan = null; cargarAdmin(e.target.value || hoyLocal(), true).then(render).catch(function (x) { toast(x.message); }); }
  });

  /* ============================================================ rutas */
  function salir(vencida) {
    S.ses = null; guardar('ses', null); S.admin = null; S.tmp = {}; S.equipoTs = 0;
    if (vencida) toast('Tu sesión venció. Ingresa de nuevo.');
    location.hash = '#/login'; render();
  }
  function render() {
    var h = (location.hash || '#/hoy').replace(/^#\/?/, '');
    var p = h.split('/');
    S.ruta = h;
    if (!S.ses && p[0] !== 'login') { location.hash = '#/login'; return; }
    if (p[0] === 'salir') {
      if (S.cola.length && !confirm('Hay ' + S.cola.length + ' registro(s) sin enviar. Se enviarán cuando vuelvas a ingresar. ¿Salir igual?')) { location.hash = '#/hoy'; return; }
      return salir();
    }
    if (p[0] === 'informe' && !esAdmin()) { location.hash = '#/hoy'; return; }
    if (p[0] === 'admin' && !esAdmin()) { location.hash = '#/hoy'; return; }
    var html;
    switch (p[0]) {
      case 'login': html = vLogin(); if (!S.equipoTs || Date.now() - S.equipoTs > 30000) cargarEquipo(); break;
      case 'obra': html = vObra(p[1]); break;
      case 'material': html = vMaterial(p[1]); break;
      case 'cierre': html = vCierre(p[1]); break;
      case 'bodega': html = vBodega(); break;
      case 'cola': html = vCola(); break;
      case 'informe': html = vInforme(p[1]); break;
      case 'admin':
        html = p[1] === 'plan' ? vAdmPlan() : p[1] === 'obras' ? vAdmObras() : p[1] === 'obra' ? vAdmObra(p[2]) :
          p[1] === 'equipo' ? vAdmEquipo() : p[1] === 'bodega' ? vAdmBodega() : vAdmin();
        break;
      default: html = vHoy();
    }
    $app.innerHTML = '<div class="app">' + html + '</div>';
  }
  var cargandoEquipo = false;
  function cargarEquipo() {
    if (cargandoEquipo || !enLinea()) return;
    cargandoEquipo = true; S.equipoTs = Date.now();
    api({ action: 'equipo' }).then(function (r) { if (r.ok) { S.equipo = r.equipo; guardar('equipo', r.equipo); } })
      .catch(function () {}).then(function () { cargandoEquipo = false; if (S.ruta === 'login') render(); });
  }

  window.addEventListener('hashchange', function () { window.scrollTo(0, 0); render(); });
  window.addEventListener('online', function () { toast('Señal recuperada'); sincronizar(); cargarInicio().then(refrescarVista); });
  window.addEventListener('offline', function () { refrescarVista(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { sincronizar(); } });
  setInterval(function () { sincronizar(); }, 30000);

  leerCola().catch(function () {}).then(function () {
    render();
    if (S.ses) { cargarInicio().then(function () { refrescarVista(); sincronizar(); }); }
  });
})();
