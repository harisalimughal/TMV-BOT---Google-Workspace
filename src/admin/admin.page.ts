export interface SidebarItem {
  key: string;
  label: string;
}

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "jobs", label: "Jobs" },
  { key: "finished", label: "Finished Jobs" },
  { key: "notifications", label: "Notifications" },
  { key: "checkin", label: "Check In" },
  { key: "checkout", label: "Check Out" },
  { key: "parking", label: "Parking Liability" },
  { key: "liability", label: "Liability Report" },
  { key: "drivers", label: "Drivers" },
  { key: "activity", label: "Activity Log" },
  { key: "settings", label: "Settings" }
];

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function loginPage(error?: string): string {
  const errorHtml = error ? `<p class="error">${escapeHtml(error)}</p>` : "";
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TMV Admin — Sign in</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f0f2f5; color: #1a1a1a; }
  .card { width: 100%; max-width: 340px; background: #fff; border-radius: 12px; padding: 28px; box-shadow: 0 1px 6px rgba(0,0,0,.1); }
  h1 { font-size: 18px; margin: 0 0 18px; }
  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
  input { width: 100%; padding: 11px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; margin-bottom: 16px; }
  button { width: 100%; padding: 12px; font-size: 15px; font-weight: 600; border: none; border-radius: 8px; background: #1a73e8; color: #fff; cursor: pointer; }
  .error { color: #b3261e; font-size: 13px; margin: -6px 0 14px; }
</style></head>
<body>
  <div class="card">
    <h1>TMV Admin</h1>
    <form method="post" action="/admin/login">
      ${errorHtml}
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autofocus required>
      <button type="submit">Sign in</button>
    </form>
  </div>
</body></html>`;
}

export function dashboardShell(): string {
  const navItems = SIDEBAR_ITEMS.map(
    item => `<button class="nav-item" data-tab="${item.key}">${escapeHtml(item.label)}</button>`
  ).join("");

  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TMV Admin</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: #f0f2f5; color: #1a1a1a; }
  .app { display: flex; min-height: 100vh; }
  .sidebar { width: 220px; flex-shrink: 0; background: #1a2233; color: #cfd6e4; padding: 16px 0; transition: margin-left .2s; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
  .sidebar h2 { color: #fff; font-size: 16px; margin: 0 18px 18px; }
  .nav-item { display: block; width: 100%; text-align: left; padding: 11px 18px; background: none; border: none; color: inherit; font-size: 14px; cursor: pointer; }
  .nav-item:hover { background: #232d43; }
  .nav-item.active { background: #1a73e8; color: #fff; }
  .logout { display: block; width: 100%; text-align: left; padding: 11px 18px; background: none; border: none; color: #cfd6e4; font-size: 13px; cursor: pointer; margin-top: 20px; border-top: 1px solid #2c3650; }
  .main { flex: 1; padding: 22px 26px; min-width: 0; }
  .topbar { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  #menuToggle { display: none; background: none; border: 1px solid #ccc; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
  h1 { font-size: 20px; margin: 0; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 18px; margin-bottom: 26px; }
  .kpi-card { display: flex; align-items: center; gap: 16px; background: #fff; border-radius: 14px; padding: 24px 22px; box-shadow: 0 1px 4px rgba(0,0,0,.07); min-height: 92px; }
  .kpi-icon { font-size: 34px; line-height: 1; flex-shrink: 0; width: 56px; height: 56px; border-radius: 12px; background: #f0f4fb; display: flex; align-items: center; justify-content: center; }
  .kpi-n { font-size: 30px; font-weight: 700; line-height: 1.1; }
  .kpi-l { font-size: 13px; color: #666; margin-top: 4px; }
  .charts-row { display: flex; flex-wrap: wrap; gap: 20px; }
  .chart-card { background: #fff; border-radius: 14px; padding: 22px; box-shadow: 0 1px 4px rgba(0,0,0,.07); flex: 1 1 320px; }
  .chart-card-wide { flex: 2 1 480px; }
  .chart-card h3 { margin: 0 0 16px; font-size: 15px; color: #333; }
  .chart-flex { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
  .donut { width: 200px; height: 200px; flex-shrink: 0; }
  .donut-total { font-size: 26px; font-weight: 700; fill: #1a1a1a; }
  .legend { display: flex; flex-direction: column; gap: 10px; }
  .legend-row { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #333; }
  .legend-dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
  .legend-n { font-weight: 600; margin-left: 4px; }
  .line-chart { width: 100%; height: auto; }
  .chart-grid { stroke: #eee; stroke-width: 1; }
  .chart-axis { font-size: 10px; fill: #888; }
  .chart-area { fill: rgba(26,115,232,.08); }
  .chart-empty { padding: 40px 0; text-align: center; color: #999; font-size: 13px; }
  .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
  .search { padding: 9px 12px; font-size: 14px; border: 1px solid #ccc; border-radius: 8px; width: 260px; max-width: 100%; }
  .add-btn { padding: 9px 16px; font-size: 14px; font-weight: 600; border: none; border-radius: 8px; background: #1a73e8; color: #fff; cursor: pointer; }
  .toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .btn-outline { padding: 9px 14px; font-size: 13px; font-weight: 600; border: 1px solid #cfd6e4; border-radius: 8px; background: #fff; color: #1a2233; cursor: pointer; }
  .btn-outline:hover { background: #f5f7fb; }
  .table-wrap { background: #fff; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.06); overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; white-space: nowrap; }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #fafbfc; font-weight: 600; color: #444; position: sticky; top: 0; }
  tr:hover td { background: #f7f9fc; }
  tr.clickable { cursor: pointer; }
  .empty { padding: 30px; text-align: center; color: #888; font-size: 14px; }
  .thumb-row { display: flex; flex-wrap: wrap; gap: 4px; }
  .thumb { width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e2e2; cursor: pointer; background: #f4f4f4; }
  .muted { color: #aaa; }
  .pill { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .pill-sent { background: #dcfce7; color: #166534; }
  .pill-failed { background: #fee2e2; color: #991b1b; cursor: help; }
  .pill-pending { background: #fef3c7; color: #92400e; }
  .pill-skipped { background: #f1f1f1; color: #888; }
  .pill-disabled { background: #e5e7eb; color: #4b5563; }
  .tick-badge { display: inline-block; color: #16a34a; font-weight: 700; cursor: help; }
  .loading { padding: 30px; text-align: center; color: #888; font-size: 14px; }
  .modal-bg { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.4); align-items: center; justify-content: center; padding: 20px; z-index: 10; }
  .modal-bg.open { display: flex; }
  .modal { background: #fff; border-radius: 12px; padding: 22px; max-width: 480px; width: 100%; max-height: 80vh; overflow-y: auto; }
  .modal h3 { margin: 0 0 14px; font-size: 16px; }
  .modal .row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
  .modal .row .k { color: #666; }
  .modal .row .v { text-align: right; word-break: break-word; }
  .modal .close { margin-top: 16px; width: 100%; padding: 10px; border: none; border-radius: 8px; background: #eee; cursor: pointer; }
  .form-label { display: block; font-size: 13px; font-weight: 600; margin: 12px 0 5px; }
  .settings-field { background: #fff; border-radius: 10px; padding: 20px; max-width: 640px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  .settings-desc { font-size: 13px; color: #666; margin: 0 0 10px; }
  .settings-textarea { width: 100%; min-height: 140px; padding: 12px; font-size: 14px; font-family: inherit; border: 1px solid #ccc; border-radius: 8px; resize: vertical; }
  .settings-save { margin-top: 12px; }
  .settings-status { margin-left: 10px; font-size: 13px; color: #666; }
  .form-input { width: 100%; padding: 10px; font-size: 14px; border: 1px solid #ccc; border-radius: 8px; }
  .form-check { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 400; margin: 14px 0 4px; }
  .modal-actions { display: flex; gap: 10px; margin-top: 20px; }
  .modal-actions .close { flex: 1; margin-top: 0; }
  .modal-actions .primary { flex: 1; padding: 10px; border: none; border-radius: 8px; background: #1a73e8; color: #fff; font-weight: 600; cursor: pointer; }
  .modal .error { color: #b3261e; font-size: 13px; margin-top: 10px; min-height: 16px; }
  .btn-spinner { display: inline-block; width: 13px; height: 13px; border: 2px solid rgba(255,255,255,.5); border-top-color: #fff; border-radius: 50%; vertical-align: -2px; margin-right: 7px; animation: tmv-spin .7s linear infinite; }
  @keyframes tmv-spin { to { transform: rotate(360deg); } }
  .modal-actions .primary:disabled { opacity: .75; cursor: default; }
  .modal-success { text-align: center; padding: 8px 4px 4px; }
  .modal-success .tick { width: 56px; height: 56px; margin: 0 auto 14px; }
  .modal-success h3 { margin: 0 0 6px; }
  .modal-success p { color: #666; font-size: 13px; margin: 0 0 18px; }
  .modal-success .close { width: 100%; padding: 10px; border: none; border-radius: 8px; background: #eee; cursor: pointer; }
  @media (max-width: 720px) {
    #menuToggle { display: inline-block; }
    .sidebar { position: fixed; top: 0; bottom: 0; left: 0; z-index: 20; margin-left: -220px; }
    .sidebar.open { margin-left: 0; box-shadow: 2px 0 12px rgba(0,0,0,.2); }
  }
</style></head>
<body>
  <div class="app">
    <div class="sidebar" id="sidebar">
      <h2>TMV Admin</h2>
      ${navItems}
      <button class="logout" id="logoutBtn">Log out</button>
    </div>
    <div class="main">
      <div class="topbar">
        <button id="menuToggle">☰</button>
        <h1 id="pageTitle">Dashboard</h1>
      </div>
      <div id="content"><div class="loading">Loading…</div></div>
    </div>
  </div>
  <div class="modal-bg" id="modalBg">
    <div class="modal" id="modal"></div>
  </div>
  <script>
  (function () {
    var TABS = ${JSON.stringify(SIDEBAR_ITEMS)};
    var content = document.getElementById('content');
    var pageTitle = document.getElementById('pageTitle');
    var sidebar = document.getElementById('sidebar');
    var currentTab = 'dashboard';
    var currentRows = [];

    document.getElementById('menuToggle').addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
    document.getElementById('logoutBtn').addEventListener('click', function () {
      fetch('/admin/logout', { method: 'POST' }).then(function () { location.href = '/admin/login'; });
    });
    document.getElementById('modalBg').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });

    function closeModal() { document.getElementById('modalBg').classList.remove('open'); }

    Array.prototype.forEach.call(document.querySelectorAll('.nav-item'), function (btn) {
      btn.addEventListener('click', function () {
        selectTab(btn.getAttribute('data-tab'));
        sidebar.classList.remove('open');
      });
    });

    function selectTab(tab) {
      currentTab = tab;
      Array.prototype.forEach.call(document.querySelectorAll('.nav-item'), function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
      });
      var meta = TABS.filter(function (t) { return t.key === tab; })[0];
      pageTitle.textContent = meta ? meta.label : tab;
      content.innerHTML = '<div class="loading">Loading…</div>';
      if (tab === 'dashboard') loadDashboard();
      else if (tab === 'settings') loadSettings();
      else if (tab === 'finished') loadFinishedJobs();
      else if (tab === 'notifications') loadNotifications();
      else loadTable(tab);
    }

    function formatDate(iso) {
      if (!iso) return '—';
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // ---------------------------------------------------------------------------
    // Export: CSV is a plain client-side Blob download. PDF has no library involved --
    // it opens a clean printable page and calls window.print(), so "Save as PDF" comes
    // from the browser's own print dialog rather than a new dependency.
    // ---------------------------------------------------------------------------
    function csvValue(v) {
      var s = v == null ? '' : String(v);
      if (/[",\\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    function downloadCsv(filename, columns, rows) {
      var lines = [columns.map(csvValue).join(',')];
      rows.forEach(function (row) {
        lines.push(columns.map(function (c) { return csvValue(row[c]); }).join(','));
      });
      // Leading BOM so Excel opens UTF-8 (£, —, etc.) correctly instead of mangling it.
      var blob = new Blob(['﻿' + lines.join('\\r\\n')], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }
    function exportPdf(title, columns, rows, cellHtml) {
      var win = window.open('', '_blank');
      if (!win) { alert('Please allow pop-ups for this site to export as PDF.'); return; }
      var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + escapeHtml(title) + '</title><style>' +
        'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:24px;color:#1a1a1a;}' +
        'h1{font-size:18px;margin:0 0 4px;}' +
        '.meta{color:#666;font-size:12px;margin:0 0 18px;}' +
        'table{border-collapse:collapse;width:100%;font-size:11px;}' +
        'th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top;}' +
        'th{background:#f5f5f5;}' +
        '.thumb{width:34px;height:34px;object-fit:cover;border-radius:4px;margin:1px;display:inline-block;}' +
        '.muted{color:#999;}' +
        '@media print { body{padding:0;} a{color:inherit;text-decoration:none;} }' +
        '</style></head><body>' +
        '<h1>' + escapeHtml(title) + '</h1>' +
        '<p class="meta">Exported ' + escapeHtml(new Date().toLocaleString('en-GB')) + ' — ' + rows.length + ' record(s)</p>' +
        '<table><thead><tr>' + columns.map(function (c) { return '<th>' + escapeHtml(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (row) {
          return '<tr>' + columns.map(function (c) {
            return '<td>' + (cellHtml ? cellHtml(c, row) : escapeHtml(String(row[c] == null ? '' : row[c]))) + '</td>';
          }).join('') + '</tr>';
        }).join('') +
        '</tbody></table>' +
        '<script>window.onload=function(){setTimeout(function(){window.print();},350);};<\\/script>' +
        '</body></html>';
      win.document.open(); win.document.write(html); win.document.close();
    }

    function loadFinishedJobs() {
      fetch('/admin/api/finished-jobs').then(function (r) {
        if (!r.ok) return r.json().then(function (b) { throw new Error(b.error || 'Failed to load.'); });
        return r.json();
      }).then(function (data) {
        var jobs = data.jobs || [];
        if (!jobs.length) {
          content.innerHTML = '<div class="table-wrap"><div class="empty">No completed jobs yet.</div></div>';
          return;
        }
        content.innerHTML =
          '<div class="toolbar"><span></span><div class="toolbar-right">' +
          '<button class="btn-outline" id="exportCsvBtn">Export CSV</button>' +
          '<button class="btn-outline" id="exportPdfBtn">Export PDF</button>' +
          '</div></div>' +
          '<div class="table-wrap"><table><thead><tr>' +
          '<th>#</th><th>Driver</th><th>Customer</th><th>Pickup → Drop-off</th><th>Started</th><th>Finished</th><th>Total</th><th>Photos</th><th>Signature</th><th>Folder</th>' +
          '</tr></thead><tbody>' +
          jobs.map(function (j, i) {
            var photosHtml = j.photos.length
              ? j.photos.map(function (p) {
                  return '<img class="thumb" src="' + p.thumbUrl + '" title="' + escapeHtml(p.label) + '" data-full="' + p.thumbUrl + '">';
                }).join('')
              : '<span class="muted">—</span>';
            var sigHtml = j.signature
              ? '<img class="thumb" src="' + j.signature.thumbUrl + '" title="' + escapeHtml(j.signature.customerName || 'Signature') + '" data-full="' + j.signature.thumbUrl + '">'
              : '<span class="muted">—</span>';
            var folderHtml = j.driveFolderUrl
              ? '<a href="' + escapeHtml(j.driveFolderUrl) + '" target="_blank" rel="noopener">Open</a>'
              : '<span class="muted">—</span>';
            return '<tr>' +
              '<td>' + (i + 1) + '</td>' +
              '<td>' + escapeHtml(j.driverName) + '</td>' +
              '<td>' + escapeHtml(j.customerName) + '</td>' +
              '<td>' + escapeHtml(j.pickup) + ' → ' + escapeHtml(j.dropoff) + '</td>' +
              '<td>' + formatDate(j.actualStart) + '</td>' +
              '<td>' + formatDate(j.actualFinish) + '</td>' +
              '<td>' + (j.totalCharges ? '£' + escapeHtml(String(j.totalCharges)) : '—') + '</td>' +
              '<td><div class="thumb-row">' + photosHtml + '</div></td>' +
              '<td>' + sigHtml + '</td>' +
              '<td>' + folderHtml + '</td>' +
              '</tr>';
          }).join('') +
          '</tbody></table></div>';
        Array.prototype.forEach.call(content.querySelectorAll('.thumb'), function (img) {
          img.addEventListener('click', function () { window.open(img.getAttribute('data-full'), '_blank'); });
        });

        var FINISHED_COLUMNS = ['#', 'Driver', 'Customer', 'Pickup', 'Drop-off', 'Started', 'Finished', 'Total', 'Photos', 'Signature', 'Folder'];
        document.getElementById('exportCsvBtn').addEventListener('click', function () {
          var rows = jobs.map(function (j, i) {
            return {
              '#': i + 1, 'Driver': j.driverName, 'Customer': j.customerName, 'Pickup': j.pickup, 'Drop-off': j.dropoff,
              'Started': formatDate(j.actualStart), 'Finished': formatDate(j.actualFinish),
              'Total': j.totalCharges ? ('£' + j.totalCharges) : '',
              'Photos': j.photos.map(function (p) { return location.origin + p.thumbUrl; }).join(' | '),
              'Signature': j.signature ? (location.origin + j.signature.thumbUrl) : '',
              'Folder': j.driveFolderUrl || ''
            };
          });
          downloadCsv('finished-jobs.csv', FINISHED_COLUMNS, rows);
        });
        document.getElementById('exportPdfBtn').addEventListener('click', function () {
          var rows = jobs.map(function (j, i) { return { j: j, i: i }; });
          exportPdf('Finished Jobs', FINISHED_COLUMNS, rows, function (c, row) {
            var j = row.j, i = row.i;
            if (c === '#') return String(i + 1);
            if (c === 'Driver') return escapeHtml(j.driverName);
            if (c === 'Customer') return escapeHtml(j.customerName);
            if (c === 'Pickup') return escapeHtml(j.pickup);
            if (c === 'Drop-off') return escapeHtml(j.dropoff);
            if (c === 'Started') return escapeHtml(formatDate(j.actualStart));
            if (c === 'Finished') return escapeHtml(formatDate(j.actualFinish));
            if (c === 'Total') return j.totalCharges ? ('£' + escapeHtml(String(j.totalCharges))) : '<span class="muted">—</span>';
            if (c === 'Photos') {
              return j.photos.length
                ? j.photos.map(function (p) { return '<img class="thumb" src="' + p.thumbUrl + '">'; }).join('')
                : '<span class="muted">—</span>';
            }
            if (c === 'Signature') return j.signature ? '<img class="thumb" src="' + j.signature.thumbUrl + '">' : '<span class="muted">—</span>';
            if (c === 'Folder') return j.driveFolderUrl ? '<a href="' + escapeHtml(j.driveFolderUrl) + '">Open</a>' : '<span class="muted">—</span>';
            return '';
          });
        });
      }).catch(showError);
    }

    // Whether the "job started" email/SMS actually reached the customer -- previously
    // only visible by digging through the raw Activity Log for CLIENT_START_EMAIL_*/
    // CLIENT_START_SMS_* rows. One row per started job here instead.
    function notifyPillHtml(status) {
      var label = { sent: 'Sent', failed: 'Failed', pending: 'Pending', skipped: 'No target', disabled: 'SMS off' }[status.state] || status.state;
      var title = status.detail ? ' title="' + escapeHtml(status.detail) + '"' : '';
      return '<span class="pill pill-' + status.state + '"' + title + '>' + label + '</span>';
    }

    function loadNotifications() {
      fetch('/admin/api/notifications').then(function (r) {
        if (!r.ok) return r.json().then(function (b) { throw new Error(b.error || 'Failed to load.'); });
        return r.json();
      }).then(function (data) {
        var rows = data.rows || [];
        if (!rows.length) {
          content.innerHTML = '<div class="table-wrap"><div class="empty">No jobs have been started yet.</div></div>';
          return;
        }
        content.innerHTML =
          '<div class="toolbar"><span></span><div class="toolbar-right">' +
          '<button class="btn-outline" id="exportCsvBtn">Export CSV</button>' +
          '<button class="btn-outline" id="exportPdfBtn">Export PDF</button>' +
          '</div></div>' +
          '<div class="table-wrap"><table><thead><tr>' +
          '<th>Job ID</th><th>Customer</th><th>Driver</th><th>Started</th>' +
          '<th>Email address</th><th>Email</th><th>Phone number</th><th>SMS</th>' +
          '</tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr>' +
              '<td>' + escapeHtml(r.jobId) + '</td>' +
              '<td>' + escapeHtml(r.customerName) + '</td>' +
              '<td>' + escapeHtml(r.driverInitials) + '</td>' +
              '<td>' + formatDate(r.actualStart) + '</td>' +
              '<td>' + (r.customerEmail ? escapeHtml(r.customerEmail) : '<span class="muted">—</span>') + '</td>' +
              '<td>' + notifyPillHtml(r.email) + '</td>' +
              '<td>' + (r.customerPhone ? escapeHtml(r.customerPhone) : '<span class="muted">—</span>') + '</td>' +
              '<td>' + notifyPillHtml(r.sms) + '</td>' +
              '</tr>';
          }).join('') +
          '</tbody></table></div>';

        var NOTIFY_COLUMNS = ['Job ID', 'Customer', 'Driver', 'Started', 'Email address', 'Email', 'Phone number', 'SMS'];
        function notifyRow(r) {
          return {
            'Job ID': r.jobId, 'Customer': r.customerName, 'Driver': r.driverInitials, 'Started': formatDate(r.actualStart),
            'Email address': r.customerEmail, 'Email': r.email.state + (r.email.detail ? ' (' + r.email.detail + ')' : ''),
            'Phone number': r.customerPhone, 'SMS': r.sms.state + (r.sms.detail ? ' (' + r.sms.detail + ')' : '')
          };
        }
        document.getElementById('exportCsvBtn').addEventListener('click', function () {
          downloadCsv('notifications.csv', NOTIFY_COLUMNS, rows.map(notifyRow));
        });
        document.getElementById('exportPdfBtn').addEventListener('click', function () {
          exportPdf('Notifications', NOTIFY_COLUMNS, rows.map(notifyRow));
        });
      }).catch(showError);
    }

    function loadSettings() {
      fetch('/admin/api/settings').then(function (r) { return r.json(); }).then(function (data) {
        var settings = data.settings || [];
        content.innerHTML = settings.map(function (s) {
          return '<div class="settings-field">' +
            '<label class="form-label">' + escapeHtml(s.label) + '</label>' +
            '<p class="settings-desc">' + escapeHtml(s.description) + '</p>' +
            '<textarea class="settings-textarea" data-key="' + escapeHtml(s.key) + '">' + escapeHtml(s.value) + '</textarea>' +
            '<button class="add-btn settings-save" data-key="' + escapeHtml(s.key) + '">Save</button>' +
            '<span class="settings-status" data-key="' + escapeHtml(s.key) + '"></span>' +
            '</div>';
        }).join('');
        Array.prototype.forEach.call(document.querySelectorAll('.settings-save'), function (btn) {
          btn.addEventListener('click', function () {
            var key = btn.getAttribute('data-key');
            var textarea = document.querySelector('.settings-textarea[data-key="' + key + '"]');
            var status = document.querySelector('.settings-status[data-key="' + key + '"]');
            btn.disabled = true;
            status.textContent = 'Saving…';
            fetch('/admin/api/settings', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: key, value: textarea.value })
            }).then(function (r) {
              if (!r.ok) return r.json().then(function (b) { throw new Error(b.error || 'Failed to save.'); });
              return r.json();
            }).then(function () {
              status.textContent = 'Saved.';
              btn.disabled = false;
            }).catch(function (err) {
              status.textContent = err.message;
              btn.disabled = false;
            });
          });
        });
      }).catch(showError);
    }

    function donutChart(data, size) {
      var total = data.reduce(function (s, d) { return s + d.value; }, 0);
      if (!total) return '<div class="chart-empty">No data yet</div>';
      var r = size / 2 - 15, cx = size / 2, cy = size / 2, circumference = 2 * Math.PI * r;
      var offset = 0;
      var arcs = data.filter(function (d) { return d.value > 0; }).map(function (d) {
        var dash = (d.value / total) * circumference;
        var circle = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + d.color +
          '" stroke-width="26" stroke-dasharray="' + dash + ' ' + (circumference - dash) +
          '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"><title>' +
          escapeHtml(d.label) + ': ' + d.value + '</title></circle>';
        offset += dash;
        return circle;
      }).join('');
      return '<svg viewBox="0 0 ' + size + ' ' + size + '" class="donut">' + arcs +
        '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="middle" class="donut-total">' + total + '</text></svg>';
    }

    function lineChart(data, width, height) {
      if (!data.length) return '<div class="chart-empty">No earnings data yet</div>';
      var padL = 44, padB = 26, padT = 14, padR = 14;
      var max = Math.max.apply(null, data.map(function (d) { return d.total; })) || 1;
      var innerW = width - padL - padR, innerH = height - padT - padB;
      var stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
      var xy = data.map(function (d, i) {
        return { x: padL + i * stepX, y: padT + innerH - (d.total / max) * innerH, d: d };
      });
      var points = xy.map(function (p) { return p.x + ',' + p.y; }).join(' ');
      var area = 'M' + padL + ',' + (padT + innerH) + ' L' + points.replace(/ /g, ' L') + ' L' + xy[xy.length - 1].x + ',' + (padT + innerH) + ' Z';
      var dots = xy.map(function (p) {
        return '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="#1a73e8"><title>' + p.d.month + ': £' + p.d.total.toFixed(2) + '</title></circle>';
      }).join('');
      var labels = xy.map(function (p) {
        return '<text x="' + p.x + '" y="' + (height - 6) + '" text-anchor="middle" class="chart-axis">' + p.d.month.slice(5) + '</text>';
      }).join('');
      var gridY = [0, 0.5, 1].map(function (f) {
        var y = padT + innerH * f;
        return '<line x1="' + padL + '" y1="' + y + '" x2="' + (width - padR) + '" y2="' + y + '" class="chart-grid"></line>' +
          '<text x="' + (padL - 8) + '" y="' + (y + 4) + '" text-anchor="end" class="chart-axis">£' + Math.round(max * (1 - f)) + '</text>';
      }).join('');
      return '<svg viewBox="0 0 ' + width + ' ' + height + '" class="line-chart">' + gridY +
        '<path d="' + area + '" class="chart-area"></path>' +
        '<polyline points="' + points + '" fill="none" stroke="#1a73e8" stroke-width="2.5"></polyline>' +
        dots + labels + '</svg>';
    }

    function loadDashboard() {
      fetch('/admin/api/dashboard').then(function (r) { return r.json(); }).then(function (data) {
        var kpis = data.kpis || [];
        var statusBreakdown = data.statusBreakdown || [];
        var monthlyEarnings = data.monthlyEarnings || [];

        var kpiHtml = '<div class="kpis">' + kpis.map(function (k) {
          return '<div class="kpi-card"><div class="kpi-icon">' + (k.icon || '📊') + '</div>' +
            '<div class="kpi-body"><div class="kpi-n">' + k.value + '</div><div class="kpi-l">' + escapeHtml(k.label) + '</div></div></div>';
        }).join('') + '</div>';

        var legendHtml = statusBreakdown.map(function (d) {
          return '<div class="legend-row"><span class="legend-dot" style="background:' + d.color + '"></span>' +
            escapeHtml(d.label) + '<span class="legend-n">' + d.value + '</span></div>';
        }).join('');

        var chartsHtml = '<div class="charts-row">' +
          '<div class="chart-card"><h3>Job status breakdown</h3><div class="chart-flex">' +
          donutChart(statusBreakdown, 200) + '<div class="legend">' + legendHtml + '</div></div></div>' +
          '<div class="chart-card chart-card-wide"><h3>Monthly earnings</h3>' + lineChart(monthlyEarnings, 560, 220) + '</div>' +
          '</div>';

        content.innerHTML = kpiHtml + chartsHtml;
      }).catch(showError);
    }

    var ADD_FORMS = {
      jobs: {
        title: 'Add job', successLabel: 'Job added', endpoint: '/admin/api/jobs',
        fields: [
          { name: 'customerName', label: 'Customer name', type: 'text', required: true, placeholder: 'e.g. John Smith' },
          { name: 'customerEmail', label: 'Customer email', type: 'email', placeholder: 'e.g. john@example.com' },
          { name: 'customerPhone', label: 'Customer phone', type: 'tel', placeholder: 'e.g. 07123 456789' },
          { name: 'pickup', label: 'Pickup address', type: 'text', required: true, placeholder: 'e.g. 12 High Street, London, SW1A 1AA' },
          { name: 'dropoff', label: 'Drop-off address', type: 'text', required: true, placeholder: 'e.g. 45 Park Road, Manchester, M1 2AB' },
          { name: 'crewSize', label: 'Crew size', type: 'number', required: true, attrs: 'min="1" step="1" value="2"' },
          { name: 'price', label: 'Price (£)', type: 'number', required: true, attrs: 'min="0.01" step="0.01"', placeholder: 'e.g. 350' },
          { name: 'start', label: 'Start', type: 'datetime-local', required: true },
          { name: 'finish', label: 'Finish', type: 'datetime-local', required: true },
          { name: 'driverInitials', label: 'Driver initials (blank = unassigned, open to any driver)', type: 'text',
            attrs: 'maxlength="5" pattern="[A-Za-z]{1,5}" title="1-5 letters, e.g. JD"', placeholder: 'e.g. JD — must match an existing driver' },
          { name: 'paidOnline', label: 'Paid online', type: 'checkbox' }
        ]
      },
      drivers: {
        title: 'Add driver', successLabel: 'Driver added', endpoint: '/admin/api/drivers',
        fields: [
          { name: 'initials', label: 'Initials (used to match jobs to this driver)', type: 'text',
            required: true, attrs: 'maxlength="5" pattern="[A-Za-z]{1,5}" title="1-5 letters, e.g. JD"', placeholder: 'e.g. JD' },
          { name: 'fullName', label: 'Full name', type: 'text', required: true, placeholder: 'e.g. James Dean' },
          { name: 'email', label: 'Email (used to sign in from Chat)', type: 'email', required: true, placeholder: 'e.g. james@tmv.co.uk' },
          { name: 'chatUserName', label: 'Chat user name (optional fallback)', type: 'text', placeholder: 'only needed if Chat login differs from email' },
          { name: 'role', label: 'Role', type: 'text', placeholder: 'e.g. Driver' },
          { name: 'active', label: 'Active', type: 'checkbox', checkedByDefault: true }
        ]
      }
    };

    function loadTable(tab) {
      fetch('/admin/api/table/' + tab).then(function (r) {
        if (!r.ok) return r.json().then(function (b) { throw new Error(b.error || 'Failed to load.'); });
        return r.json();
      }).then(function (data) {
        currentRows = data.rows || [];
        var columns = data.columns || [];
        var addForm = ADD_FORMS[tab];
        var addBtn = addForm ? '<button class="add-btn" id="addBtn">+ ' + escapeHtml(addForm.title) + '</button>' : '';
        if (!currentRows.length) {
          content.innerHTML = '<div class="toolbar"><input class="search" placeholder="Search…" disabled>' + addBtn + '</div><div class="table-wrap"><div class="empty">No records yet.</div></div>';
        } else {
          var exportBtns =
            '<button class="btn-outline" id="exportCsvBtn">Export CSV</button>' +
            '<button class="btn-outline" id="exportPdfBtn">Export PDF</button>';
          content.innerHTML =
            '<div class="toolbar"><input class="search" id="searchBox" placeholder="Search…">' +
            '<div class="toolbar-right">' + exportBtns + addBtn + '</div></div>' +
            '<div class="table-wrap"><table><thead><tr>' +
            columns.map(function (c) { return '<th>' + escapeHtml(c) + '</th>'; }).join('') +
            '</tr></thead><tbody id="tbody"></tbody></table></div>';
          renderRows(columns, currentRows, tab);
          document.getElementById('searchBox').addEventListener('input', function (e) {
            var q = e.target.value.trim().toLowerCase();
            var filtered = !q ? currentRows : currentRows.filter(function (row) {
              return columns.some(function (c) { return String(row[c] || '').toLowerCase().indexOf(q) !== -1; });
            });
            renderRows(columns, filtered, tab);
          });
          document.getElementById('exportCsvBtn').addEventListener('click', function () {
            downloadCsv(tab + '.csv', columns, currentRows);
          });
          document.getElementById('exportPdfBtn').addEventListener('click', function () {
            var meta = TABS.filter(function (t) { return t.key === tab; })[0];
            exportPdf(meta ? meta.label : tab, columns, currentRows, function (c, row) {
              if (DRIVE_LINK_COLUMNS.indexOf(c) !== -1) return driveThumbsHtml(row[c]);
              return escapeHtml(String(row[c] == null ? '' : row[c]));
            });
          });
        }
        if (addForm) {
          document.getElementById('addBtn').addEventListener('click', function () { openAddForm(tab, addForm); });
        }
      }).catch(showError);
    }

    function openAddForm(tab, form) {
      var modal = document.getElementById('modal');
      modal.innerHTML = '<h3>' + escapeHtml(form.title) + '</h3><form id="addForm">' +
        form.fields.map(function (f) {
          if (f.type === 'checkbox') {
            return '<label class="form-check"><input type="checkbox" name="' + f.name + '"' + (f.checkedByDefault ? ' checked' : '') + '> ' + escapeHtml(f.label) + '</label>';
          }
          return '<label class="form-label">' + escapeHtml(f.label) + (f.required ? ' *' : '') + '</label>' +
            '<input class="form-input" type="' + f.type + '" name="' + f.name + '"' + (f.required ? ' required' : '') +
              (f.placeholder ? ' placeholder="' + escapeHtml(f.placeholder) + '"' : '') + (f.attrs ? ' ' + f.attrs : '') + '>';
        }).join('') +
        '<div id="formError" class="error"></div>' +
        '<div class="modal-actions"><button type="button" class="close" id="modalCancel">Cancel</button><button type="submit" class="primary">Save</button></div>' +
        '</form>';
      document.getElementById('modalCancel').addEventListener('click', closeModal);
      document.getElementById('addForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var payload = {};
        form.fields.forEach(function (f) {
          var el = document.querySelector('[name="' + f.name + '"]');
          payload[f.name] = f.type === 'checkbox' ? el.checked : el.value.trim();
        });
        var submitBtn = e.target.querySelector('button[type=submit]');
        var cancelBtn = document.getElementById('modalCancel');
        var originalLabel = submitBtn.textContent;
        submitBtn.disabled = true;
        cancelBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-spinner"></span>Saving…';
        fetch(form.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        }).then(function (r) {
          if (!r.ok) return r.json().then(function (b) { throw new Error(b.error || 'Failed to save.'); });
          return r.json();
        }).then(function () {
          loadTable(tab);
          showSavedModal(form.successLabel || (form.title + ' saved'));
        }).catch(function (err) {
          document.getElementById('formError').textContent = err.message;
          submitBtn.disabled = false;
          cancelBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        });
      });
      document.getElementById('modalBg').classList.add('open');
    }

    function showSavedModal(message) {
      var modal = document.getElementById('modal');
      modal.innerHTML =
        '<div class="modal-success">' +
        '<svg class="tick" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="none" stroke="#22c55e" stroke-width="3"></circle>' +
        '<path fill="none" stroke="#22c55e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M14 27l7 7 17-17"></path></svg>' +
        '<h3>' + escapeHtml(message) + '</h3>' +
        '<p>You can close this now.</p>' +
        '<button class="close" id="savedClose">Close</button>' +
        '</div>';
      document.getElementById('savedClose').addEventListener('click', closeModal);
      setTimeout(closeModal, 1600);
    }

    // Photo URLs / Signature URL cells hold one or more Drive webViewLinks (pipe-joined
    // for Photo URLs) -- shown as raw text before, which meant a driver's photo was a
    // wall of unclickable-looking URLs instead of something you could actually glance
    // at. The file id lives right inside that URL's stable ".../file/d/<id>/..." shape,
    // so it can be pulled out client-side and pointed at the same authenticated
    // thumbnail proxy the Finished Jobs tab uses -- no server changes needed here.
    var DRIVE_LINK_COLUMNS = ['Photo URLs', 'Signature URL'];
    function driveThumbsHtml(cellValue) {
      var ids = String(cellValue || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean)
        .map(function (u) { var m = u.match(/\\/d\\/([A-Za-z0-9_-]+)/); return m ? m[1] : null; })
        .filter(Boolean);
      if (!ids.length) return '<span class="muted">—</span>';
      return '<div class="thumb-row">' + ids.map(function (id) {
        var src = '/admin/api/drive-file/' + id;
        return '<img class="thumb" src="' + src + '" data-full="' + src + '">';
      }).join('') + '</div>';
    }
    function bindThumbClicks(root) {
      Array.prototype.forEach.call(root.querySelectorAll('.thumb'), function (img) {
        img.addEventListener('click', function (e) {
          e.stopPropagation();
          window.open(img.getAttribute('data-full'), '_blank');
        });
      });
    }

    function renderRows(columns, rows, tab) {
      var tbody = document.getElementById('tbody');
      if (!tbody) return;
      tbody.innerHTML = rows.map(function (row, i) {
        return '<tr class="clickable" data-i="' + i + '">' +
          columns.map(function (c) {
            if (DRIVE_LINK_COLUMNS.indexOf(c) !== -1) return '<td>' + driveThumbsHtml(row[c]) + '</td>';
            if (tab === 'jobs' && c === 'Job ID' && row['Status'] === 'COMPLETED') {
              return '<td><span class="tick-badge" title="This job is finished">&#10003;</span> ' + escapeHtml(String(row[c] || '')) + '</td>';
            }
            return '<td>' + escapeHtml(String(row[c] || '')) + '</td>';
          }).join('') +
          '</tr>';
      }).join('');
      bindThumbClicks(tbody);
      Array.prototype.forEach.call(tbody.querySelectorAll('tr'), function (tr) {
        tr.addEventListener('click', function () {
          openDetail(columns, rows[Number(tr.getAttribute('data-i'))]);
        });
      });
    }

    function openDetail(columns, row) {
      var modal = document.getElementById('modal');
      modal.innerHTML = '<h3>Details</h3>' +
        columns.map(function (c) {
          var v = DRIVE_LINK_COLUMNS.indexOf(c) !== -1 ? driveThumbsHtml(row[c]) : escapeHtml(String(row[c] || '—'));
          return '<div class="row"><div class="k">' + escapeHtml(c) + '</div><div class="v">' + v + '</div></div>';
        }).join('') +
        '<button class="close" id="modalClose">Close</button>';
      bindThumbClicks(modal);
      document.getElementById('modalClose').addEventListener('click', closeModal);
      document.getElementById('modalBg').classList.add('open');
    }

    function showError(err) {
      content.innerHTML = '<div class="empty">' + escapeHtml(err.message || 'Something went wrong.') + '</div>';
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    selectTab('dashboard');
  })();
  </script>
</body></html>`;
}
