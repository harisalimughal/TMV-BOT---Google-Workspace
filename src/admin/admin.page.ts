export interface SidebarItem {
  key: string;
  label: string;
}

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "jobs", label: "Jobs" },
  { key: "checkin", label: "Check In" },
  { key: "checkout", label: "Check Out" },
  { key: "parking", label: "Parking Liability" },
  { key: "liability", label: "Liability Report" },
  { key: "drivers", label: "Drivers" }
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
  .sidebar { width: 220px; flex-shrink: 0; background: #1a2233; color: #cfd6e4; padding: 16px 0; transition: margin-left .2s; }
  .sidebar h2 { color: #fff; font-size: 16px; margin: 0 18px 18px; }
  .nav-item { display: block; width: 100%; text-align: left; padding: 11px 18px; background: none; border: none; color: inherit; font-size: 14px; cursor: pointer; }
  .nav-item:hover { background: #232d43; }
  .nav-item.active { background: #1a73e8; color: #fff; }
  .logout { display: block; width: 100%; text-align: left; padding: 11px 18px; background: none; border: none; color: #cfd6e4; font-size: 13px; cursor: pointer; margin-top: 20px; border-top: 1px solid #2c3650; }
  .main { flex: 1; padding: 22px 26px; min-width: 0; }
  .topbar { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  #menuToggle { display: none; background: none; border: 1px solid #ccc; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
  h1 { font-size: 20px; margin: 0; }
  .kpis { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 22px; }
  .kpi { background: #fff; border-radius: 10px; padding: 16px 20px; min-width: 140px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  .kpi .n { font-size: 24px; font-weight: 700; }
  .kpi .l { font-size: 12px; color: #666; margin-top: 4px; }
  .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
  .search { padding: 9px 12px; font-size: 14px; border: 1px solid #ccc; border-radius: 8px; width: 260px; max-width: 100%; }
  .add-btn { padding: 9px 16px; font-size: 14px; font-weight: 600; border: none; border-radius: 8px; background: #1a73e8; color: #fff; cursor: pointer; }
  .table-wrap { background: #fff; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.06); overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; white-space: nowrap; }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #fafbfc; font-weight: 600; color: #444; position: sticky; top: 0; }
  tr:hover td { background: #f7f9fc; }
  tr.clickable { cursor: pointer; }
  .empty { padding: 30px; text-align: center; color: #888; font-size: 14px; }
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
  .form-input { width: 100%; padding: 10px; font-size: 14px; border: 1px solid #ccc; border-radius: 8px; }
  .form-check { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 400; margin: 14px 0 4px; }
  .modal-actions { display: flex; gap: 10px; margin-top: 20px; }
  .modal-actions .close { flex: 1; margin-top: 0; }
  .modal-actions .primary { flex: 1; padding: 10px; border: none; border-radius: 8px; background: #1a73e8; color: #fff; font-weight: 600; cursor: pointer; }
  .modal .error { color: #b3261e; font-size: 13px; margin-top: 10px; min-height: 16px; }
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
      if (tab === 'dashboard') loadDashboard(); else loadTable(tab);
    }

    function loadDashboard() {
      fetch('/admin/api/dashboard').then(function (r) { return r.json(); }).then(function (data) {
        var kpis = data.kpis || [];
        var html = '<div class="kpis">' + kpis.map(function (k) {
          return '<div class="kpi"><div class="n">' + k.value + '</div><div class="l">' + escapeHtml(k.label) + '</div></div>';
        }).join('') + '</div>';
        content.innerHTML = html;
      }).catch(showError);
    }

    var ADD_FORMS = {
      jobs: {
        title: 'Add job', endpoint: '/admin/api/jobs',
        fields: [
          { name: 'customerName', label: 'Customer name', type: 'text', required: true },
          { name: 'customerEmail', label: 'Customer email', type: 'email' },
          { name: 'customerPhone', label: 'Customer phone', type: 'tel' },
          { name: 'pickup', label: 'Pickup address', type: 'text', required: true },
          { name: 'dropoff', label: 'Drop-off address', type: 'text', required: true },
          { name: 'crewSize', label: 'Crew size', type: 'number', required: true },
          { name: 'price', label: 'Price (£)', type: 'number', required: true },
          { name: 'start', label: 'Start', type: 'datetime-local', required: true },
          { name: 'finish', label: 'Finish', type: 'datetime-local', required: true },
          { name: 'driverInitials', label: 'Driver initials (blank = unassigned, open to any driver)', type: 'text' },
          { name: 'paidOnline', label: 'Paid online', type: 'checkbox' }
        ]
      },
      drivers: {
        title: 'Add driver', endpoint: '/admin/api/drivers',
        fields: [
          { name: 'initials', label: 'Initials', type: 'text', required: true },
          { name: 'fullName', label: 'Full name', type: 'text', required: true },
          { name: 'email', label: 'Email (used to sign in from Chat)', type: 'email', required: true },
          { name: 'chatUserName', label: 'Chat user name (optional fallback)', type: 'text' },
          { name: 'role', label: 'Role', type: 'text' },
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
          content.innerHTML =
            '<div class="toolbar"><input class="search" id="searchBox" placeholder="Search…">' + addBtn + '</div>' +
            '<div class="table-wrap"><table><thead><tr>' +
            columns.map(function (c) { return '<th>' + escapeHtml(c) + '</th>'; }).join('') +
            '</tr></thead><tbody id="tbody"></tbody></table></div>';
          renderRows(columns, currentRows);
          document.getElementById('searchBox').addEventListener('input', function (e) {
            var q = e.target.value.trim().toLowerCase();
            var filtered = !q ? currentRows : currentRows.filter(function (row) {
              return columns.some(function (c) { return String(row[c] || '').toLowerCase().indexOf(q) !== -1; });
            });
            renderRows(columns, filtered);
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
            '<input class="form-input" type="' + f.type + '" name="' + f.name + '"' + (f.required ? ' required' : '') + '>';
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
        submitBtn.disabled = true;
        fetch(form.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        }).then(function (r) {
          if (!r.ok) return r.json().then(function (b) { throw new Error(b.error || 'Failed to save.'); });
          return r.json();
        }).then(function () {
          closeModal();
          loadTable(tab);
        }).catch(function (err) {
          document.getElementById('formError').textContent = err.message;
          submitBtn.disabled = false;
        });
      });
      document.getElementById('modalBg').classList.add('open');
    }

    function renderRows(columns, rows) {
      var tbody = document.getElementById('tbody');
      if (!tbody) return;
      tbody.innerHTML = rows.map(function (row, i) {
        return '<tr class="clickable" data-i="' + i + '">' +
          columns.map(function (c) { return '<td>' + escapeHtml(String(row[c] || '')) + '</td>'; }).join('') +
          '</tr>';
      }).join('');
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
          return '<div class="row"><div class="k">' + escapeHtml(c) + '</div><div class="v">' + escapeHtml(String(row[c] || '—')) + '</div></div>';
        }).join('') +
        '<button class="close" id="modalClose">Close</button>';
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
