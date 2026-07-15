import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SUPERADMIN_TOKEN_KEY = 'duo_superadmin_token';

// ── Icons Pack (SVG Helpers) ────────────────────────────────────────────────
const KeyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
);
const DatabaseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
);
const TerminalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
);
const ExportIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);
const SaveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
);
const LogOutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
);

export default function SuperAdmin() {
  const [secretKey, setSecretKey] = useState('');
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(SUPERADMIN_TOKEN_KEY));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Directory Data
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('admins'); // 'admins' | 'all-users' | 'sql'
  const [dataLoaded, setDataLoaded] = useState(false);

  // SQL Engine
  const [tableList, setTableList] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableCols, setTableCols] = useState([]);
  const [tableRows, setTableRows] = useState([]);
  const [tablePage, setTablePage] = useState(1);
  const [tableLimit, setTableLimit] = useState(15);
  const [tableTotal, setTableTotal] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableMsg, setTableMsg] = useState('');
  const [editedCells, setEditedCells] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('ASC');
  const [showAddRow, setShowAddRow] = useState(false);
  const [addRowSchema, setAddRowSchema] = useState([]);
  const [addRowValues, setAddRowValues] = useState({});
  const [filtersState, setFiltersState] = useState([]);
  const [filterLogic, setFilterLogic] = useState('AND');
  const [filterCol, setFilterCol] = useState('');
  const [filterOp, setFilterOp] = useState('=');
  const [filterVal, setFilterVal] = useState('');
  const [tableSchema, setTableSchema] = useState({ columns: [], foreignKeys: [] });
  const [showFkModal, setShowFkModal] = useState(false);
  const [fkModalState, setFkModalState] = useState({ table: null, rows: [], cols: [], page: 1, total: 0 });
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newCol, setNewCol] = useState({ name: '', type: 'TEXT', nullable: true });
  const [showRawSql, setShowRawSql] = useState(false);
  const [rawSqlText, setRawSqlText] = useState('SELECT * FROM users LIMIT 50');
  const [sqlRows, setSqlRows] = useState([]);
  const [sqlCols, setSqlCols] = useState([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditColumn, setBulkEditColumn] = useState('');
  const [bulkEditValue, setBulkEditValue] = useState('');

  // Modals
  const [pwModal, setPwModal] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [createMsg, setCreateMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const getAuthHeader = () => {
    const token = localStorage.getItem(SUPERADMIN_TOKEN_KEY);
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/superadmin/verify', { secretKey });
      localStorage.setItem(SUPERADMIN_TOKEN_KEY, res.data.token);
      setAuthed(true);
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication key rejection.');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [adminsRes, usersRes] = await Promise.all([
        axios.get('/api/superadmin/admins', getAuthHeader()),
        axios.get('/api/superadmin/users', getAuthHeader())
      ]);
      setAdmins(adminsRes.data);
      setUsers(usersRes.data);
      setDataLoaded(true);
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout();
        setError('Session expired. Authorization key required.');
      }
    }
  };

  const handlePasswordChange = async () => {
    if (!newPw || newPw.length < 6) { 
      setPwMsg('Target values must contain at least 6 characters.'); 
      return; 
    }
    setPwMsg('');
    try {
      const res = await axios.put(`/api/superadmin/users/${pwModal.id}/password`, { newPassword: newPw }, getAuthHeader());
      setPwMsg(res.data.message);
      setNewPw('');
      setTimeout(() => { setPwModal(null); setPwMsg(''); }, 1500);
    } catch (err) {
      setPwMsg(err.response?.data?.error || 'Update procedure rejected by database.');
    }
  };

  const handleCreateAdmin = async () => {
    setCreateMsg('');
    if (!createForm.name || !createForm.email || !createForm.password) {
      setCreateMsg('All credential elements are required.');
      return;
    }
    try {
      const res = await axios.post('/api/superadmin/admins', createForm, getAuthHeader());
      setCreateMsg(res.data.message);
      setCreateForm({ name: '', email: '', password: '', role: 'admin' });
      setTimeout(() => { setShowCreate(false); setCreateMsg(''); loadData(); }, 1500);
    } catch (err) {
      setCreateMsg(err.response?.data?.error || 'Account persistence error.');
    }
  };

  const handleDelete = async (userId) => {
    try {
      const res = await axios.delete(`/api/superadmin/users/${userId}`, getAuthHeader());
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Record deletion rejected.');
    }
  };

  const loadTableList = async () => {
    try {
      const res = await axios.get('/api/superadmin/sql/tables', getAuthHeader());
      setTableList(res.data.tables);
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Database catalog read failure.');
    }
  };

  const loadTableData = async (table, page = 1, sortByParam = null, sortDirParam = null) => {
    if (!table) return;
    setTableLoading(true);
    setTableMsg('');
    try {
      const params = { page, limit: tableLimit };
      if (filtersState && filtersState.length) params.filters = JSON.stringify(filtersState);
      if (filterLogic) params.logic = filterLogic;
      const activeSortBy = sortByParam !== null ? sortByParam : sortBy;
      const activeSortDir = sortDirParam !== null ? sortDirParam : sortDir;
      if (activeSortBy) {
        params.sortBy = activeSortBy;
        params.sortDir = activeSortDir;
      }
      const res = await axios.get(`/api/superadmin/sql/table/${table}`, {
        params,
        ...getAuthHeader()
      });
      setSelectedTable(table);
      setTableCols(res.data.columns.map(c => c.name || c));
      setTableRows(res.data.rows);
      setTablePage(res.data.page);
      setTableLimit(res.data.limit);
      setTableTotal(res.data.total);
      setEditedCells({});
      setSelectedIds(new Set());
      setTableSchema({ columns: res.data.columns || [], foreignKeys: res.data.foreignKeys || [] });
    } catch (err) {
      setTableRows([]);
      setTableCols([]);
      setTablePage(1);
      setTableTotal(0);
      setTableMsg(err.response?.data?.error || 'Catalog access exception.');
    } finally {
      setTableLoading(false);
    }
  };

  const handleSortColumn = (col) => {
    if (!selectedTable) return;
    const nextDir = sortBy === col && sortDir === 'ASC' ? 'DESC' : 'ASC';
    setSortBy(col);
    setSortDir(nextDir);
    loadTableData(selectedTable, tablePage, col, nextDir);
  };

  const saveTableChanges = async () => {
    const changes = Object.entries(editedCells).map(([key, value]) => {
      const [id, column] = key.split('::');
      return { id: Number(id), column, value };
    });
    if (changes.length === 0) {
      setTableMsg('No pending values discovered.');
      return;
    }
    try {
      const res = await axios.post(`/api/superadmin/sql/table/${selectedTable}/save`, { changes }, getAuthHeader());
      setTableMsg(res.data.message || 'Transactions executed.');
      loadTableData(selectedTable, tablePage);
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Pipeline execution failed.');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return setTableMsg('Select records first.');
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} records permanently?`)) return;
    try {
      const ids = Array.from(selectedIds);
      const res = await axios.post(`/api/superadmin/sql/table/${selectedTable}/delete`, { ids }, getAuthHeader());
      setTableMsg(`${res.data.changes || 0} items purged.`);
      loadTableData(selectedTable, tablePage);
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Execution context failure.');
    }
  };

  const handleExport = async (selectedOnly = false) => {
    try {
      const params = selectedOnly && selectedIds.size ? { ids: Array.from(selectedIds) } : {};
      const query = new URLSearchParams();
      if (params.ids) params.ids.forEach(id => query.append('ids', id));
      const url = `/api/superadmin/sql/table/${selectedTable}/export${query.toString() ? '?' + query.toString() : ''}`;
      const res = await axios.get(url, { responseType: 'blob', ...getAuthHeader() });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `${selectedTable}_extract.csv`;
      link.click();
      setTableMsg('CSV streaming finalized.');
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Database extract stream failure.');
    }
  };

  const openAddRow = async () => {
    if (!selectedTable) return setTableMsg('Target catalog entity unspecified.');
    try {
      const res = await axios.get(`/api/superadmin/sql/table/${selectedTable}/schema`, getAuthHeader());
      setAddRowSchema(res.data.columns || []);
      const defaults = {};
      (res.data.columns || []).forEach(c => { defaults[c.name] = null; });
      setAddRowValues(defaults);
      setShowAddRow(true);
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Schema catalog error.');
    }
  };

  const handleAddRow = async () => {
    try {
      await axios.post(`/api/superadmin/sql/table/${selectedTable}/add-row`, { values: addRowValues }, getAuthHeader());
      setShowAddRow(false);
      loadTableData(selectedTable, 1);
      setTableMsg('Record persisted.');
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Insertion parameters rejected.');
    }
  };

  const addFilter = (filter) => {
    setFiltersState(prev => [...prev, filter]);
  };

  const removeFilter = (idx) => {
    setFiltersState(prev => prev.filter((_, i) => i !== idx));
  };

  const applyFilters = () => {
    if (!selectedTable) return setTableMsg('Target table not specified.');
    loadTableData(selectedTable, 1);
  };

  const openFkModal = async (fk, cellValue, targetRowId, targetCol) => {
    try {
      setShowFkModal(true);
      setFkModalState(s => ({ ...s, table: fk.table, page: 1, rows: [], cols: [], fkTo: fk.to, targetRowId, targetCol }));
      const params = { limit: 15, page: 1, filters: JSON.stringify([{ column: fk.to, op: '=', value: cellValue }]) };
      const res = await axios.get(`/api/superadmin/sql/table/${fk.table}`, { params, ...getAuthHeader() });
      setFkModalState({ table: fk.table, rows: res.data.rows, cols: res.data.columns.map(c => c.name || c), page: res.data.page, total: res.data.total, fkTo: fk.to, targetRowId, targetCol });
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Relation fetch aborted.');
    }
  };

  const closeFkModal = () => setShowFkModal(false);

  const handleAddColumn = async () => {
    if (!newCol.name || !newCol.type) return setTableMsg('Identifier structures missing parameters.');
    try {
      await axios.post(`/api/superadmin/sql/table/${selectedTable}/add-column`, { name: newCol.name, type: newCol.type, nullable: newCol.nullable }, getAuthHeader());
      setShowAddColumn(false);
      setNewCol({ name: '', type: 'TEXT', nullable: true });
      loadTableData(selectedTable, 1);
      setTableMsg('Alteration executed successfully.');
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Column creation rejected.');
    }
  };

  const handleRunRawSql = async () => {
    try {
      const res = await axios.post('/api/superadmin/sql/execute', { sql: rawSqlText }, getAuthHeader());
      const rows = res.data.rows || [];
      setSqlRows(rows);
      setSqlCols(rows.length ? Object.keys(rows[0]) : []);
      setTableMsg('Query execution complete.');
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Parser exception encountered.');
    }
  };

  const handleBulkEdit = async () => {
    if (!selectedTable) return setTableMsg('Please select a target database catalog.');
    if (selectedIds.size === 0) return setTableMsg('No primary keys specified.');
    if (!bulkEditColumn) return setTableMsg('Column parameters required.');
    try {
      const ids = Array.from(selectedIds);
      const changes = { [bulkEditColumn]: bulkEditValue };
      await axios.post(`/api/superadmin/sql/table/${selectedTable}/bulk-update`, { ids, changes }, getAuthHeader());
      setShowBulkEdit(false);
      setBulkEditColumn(''); 
      setBulkEditValue('');
      loadTableData(selectedTable, tablePage);
      setTableMsg('Transact pipeline executed.');
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Execution engine transaction rejected.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SUPERADMIN_TOKEN_KEY);
    setAuthed(false);
    setDataLoaded(false);
    setAdmins([]);
    setUsers([]);
  };

  useEffect(() => {
    if (authed) {
      if (!dataLoaded) loadData();
      loadTableList();
    }
  }, [authed]);

  const displayData = tab === 'admins' ? admins : users;
  const tableMinWidth = Math.max(960, (tableCols.length + 2) * 180);

  // ── Neon Styled Dark Theme Sheet Styles ──────────────────────────────
  const NeonStyle = {
    appContainer: {
      minHeight: '100vh',
      backgroundColor: '#070708',
      backgroundImage: 'radial-gradient(ellipse at top, rgba(0, 229, 153, 0.03) 0%, transparent 60%)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#f3f4f6',
      padding: '32px'
    },
    panelCard: {
      background: '#0c0d10',
      border: '1px solid #1f2128',
      borderRadius: '12px',
      boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
      overflow: 'hidden'
    },
    input: {
      width: '100%',
      backgroundColor: '#14161a',
      border: '1px solid #2a2d35',
      borderRadius: '8px',
      padding: '10px 14px',
      color: '#ffffff',
      fontSize: '14px',
      outline: 'none',
      transition: 'all 0.2s ease',
      boxSizing: 'border-box'
    },
    btnPrimary: {
      padding: '10px 20px',
      background: 'linear-gradient(135deg, #00e599 0%, #00b377 100%)',
      border: 'none',
      borderRadius: '8px',
      color: '#070708',
      fontSize: '13.5px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      boxShadow: '0 4px 14px rgba(0, 229, 153, 0.2)',
      transition: 'all 0.15s ease'
    },
    btnSecondary: {
      padding: '10px 16px',
      background: '#14161a',
      border: '1px solid #2a2d35',
      borderRadius: '8px',
      color: '#9ca3af',
      fontSize: '13px',
      fontWeight: '500',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.15s ease'
    },
    btnDanger: {
      padding: '10px 16px',
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.2)',
      borderRadius: '8px',
      color: '#f87171',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.15s ease'
    },
    tabBtn: (active) => ({
      padding: '14px 20px',
      background: 'transparent',
      border: 'none',
      borderBottom: active ? '2px solid #00e599' : '2px solid transparent',
      color: active ? '#ffffff' : '#9ca3af',
      fontSize: '13.5px',
      fontWeight: active ? '600' : '400',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    }),
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 5, 5, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }
  };

  // ── Authentication Protection Screen ───────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#070708', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ 
              width: 52, height: 52, borderRadius: 12, 
              background: 'linear-gradient(135deg, #00e599 0%, #0070f3 100%)', 
              margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              fontSize: 22, fontWeight: 700, color: '#ffffff', boxShadow: '0 0 24px rgba(0, 229, 153, 0.3)' 
            }}>S</div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#ffffff', margin: 0 }}>Superadmin Console</h1>
            <p style={{ color: '#9ca3af', fontSize: '13.5px', marginTop: 8 }}>Cryptographically secure master utility workspace</p>
          </div>

          <div style={NeonStyle.panelCard}>
            <div style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 24 }}>
                <KeyIcon />
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', margin: 0 }}>Challenge Authentication</h2>
              </div>

              {error && (
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '12px 16px', color: '#f87171', fontSize: '13px', marginBottom: 20 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleVerify}>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>Master Secret Token</label>
                  <input 
                    type="password" 
                    value={secretKey} 
                    onChange={e => setSecretKey(e.target.value)} 
                    required
                    style={NeonStyle.input} 
                    placeholder="••••••••••••••••••••••••" 
                    onFocus={e => {
                      e.target.style.borderColor = '#00e599';
                      e.target.style.boxShadow = '0 0 12px rgba(0, 229, 153, 0.15)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#2a2d35';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading} 
                  style={{ ...NeonStyle.btnPrimary, width: '100%', justifyContent: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  {loading ? 'Validating Token...' : 'Unlock Workspace'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Standard Superadmin Portal Interface ───────────────────────────────
  return (
    <div style={NeonStyle.appContainer}>
      
      {/* Header Grid */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ 
              width: 32, height: 32, borderRadius: '8px', 
              background: 'linear-gradient(135deg, #00e599 0%, #0070f3 100%)', 
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', 
              fontSize: '15px', fontWeight: 700, color: '#ffffff' 
            }}>S</span>
            Superadmin
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: 6, margin: 0 }}>System configuration and arbitrary database catalog manipulation panel.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <a href="/" style={{ ...NeonStyle.btnSecondary, textDecoration: 'none' }}>&larr; Back to App</a>
          <button onClick={handleLogout} style={NeonStyle.btnDanger}>
            <LogOutIcon /> Lock Terminal
          </button>
        </div>
      </div>

      {/* Primary Tab Workspace Selection Bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: 24, borderBottom: '1px solid #1f2128' }}>
        <button style={NeonStyle.tabBtn(tab === 'admins')} onClick={() => setTab('admins')}>
          Administrators & Managers ({admins.length})
        </button>
        <button style={NeonStyle.tabBtn(tab === 'all-users')} onClick={() => setTab('all-users')}>
          All Directory Users ({users.length})
        </button>
        <button style={NeonStyle.tabBtn(tab === 'sql')} onClick={() => setTab('sql')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><DatabaseIcon /> SQL Workspace</span>
        </button>
      </div>

      {/* Directory Management Workspaces */}
      {(tab === 'admins' || tab === 'all-users') && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
              {tab === 'admins' ? 'Administrative Accounts' : 'Complete Directory User Listing'}
            </h3>
            {tab === 'admins' && (
              <button onClick={() => setShowCreate(true)} style={NeonStyle.btnPrimary}>
                <PlusIcon /> Create Admin
              </button>
            )}
          </div>

          <div style={NeonStyle.panelCard}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#0e1013', borderBottom: '1px solid #1f2128' }}>
                  <th style={{ padding: '16px 20px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '16px 20px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Email Address</th>
                  <th style={{ padding: '16px 20px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Role Constraint</th>
                  <th style={{ padding: '16px 20px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Sales Cycle Trigger</th>
                  <th style={{ padding: '16px 20px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Registration Date</th>
                  <th style={{ padding: '16px 20px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, textAlign: 'right' }}>Management</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #14161a', transition: 'background-color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '16px 20px', color: '#ffffff', fontSize: '14px', fontWeight: 500 }}>{u.name}</td>
                    <td style={{ padding: '16px 20px', color: '#9ca3af', fontSize: '13.5px' }}>{u.email}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase',
                        background: u.role === 'admin' ? 'rgba(0, 229, 153, 0.08)' : u.role === 'manager' ? 'rgba(0, 112, 243, 0.08)' : 'rgba(156, 163, 175, 0.08)',
                        color: u.role === 'admin' ? '#00e599' : u.role === 'manager' ? '#3b82f6' : '#9ca3af',
                        border: `1px solid ${u.role === 'admin' ? 'rgba(0, 229, 153, 0.2)' : u.role === 'manager' ? 'rgba(0, 112, 243, 0.2)' : 'rgba(156, 163, 175, 0.2)'}`
                      }}>{u.role}</span>
                    </td>
                    <td style={{ padding: '16px 20px', color: '#9ca3af', fontSize: '13px' }}>Day {u.sales_cycle_start} of month</td>
                    <td style={{ padding: '16px 20px', color: '#6b7280', fontSize: '13px' }}>{u.created_at ? new Date(u.created_at + 'Z').toLocaleDateString() : 'Original Seed'}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setPwModal(u); setNewPw(''); setPwMsg(''); }} style={NeonStyle.btnSecondary}>Reset Password</button>
                        <button onClick={() => setDeleteConfirm(u)} style={NeonStyle.btnDanger}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {displayData.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                      No record matches returned.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Interactive Database SQL Execution Workspace */}
      {tab === 'sql' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Tables Side Panel Navigation */}
          <div style={{ ...NeonStyle.panelCard, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Database Catalog</span>
              <button onClick={loadTableList} style={{ ...NeonStyle.btnSecondary, padding: '4px 8px' }} title="Reload Catalog">
                <RefreshIcon />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '540px', overflowY: 'auto' }}>
              {tableList.map(table => (
                <button 
                  key={table} 
                  onClick={() => { setSortBy(''); setSortDir('ASC'); loadTableData(table, 1, '', 'ASC'); }}
                  style={{
                    width: '100%', textAlign: 'left', border: 'none', borderRadius: '6px',
                    padding: '10px 12px', cursor: 'pointer', fontSize: '13px',
                    background: table === selectedTable ? 'rgba(0, 229, 153, 0.08)' : 'transparent', 
                    color: table === selectedTable ? '#00e599' : '#9ca3af',
                    fontWeight: table === selectedTable ? '600' : '400',
                    borderLeft: table === selectedTable ? '2px solid #00e599' : '2px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { if (table !== selectedTable) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { if (table !== selectedTable) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {table}
                </button>
              ))}
              {tableList.length === 0 && (
                <span style={{ color: '#6b7280', fontSize: '13px', padding: '12px 0' }}>No user tables defined.</span>
              )}
            </div>
          </div>

          {/* Table Data Workspace */}
          <div style={{ ...NeonStyle.panelCard, padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '680px' }}>
            
            {/* Control Bar Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>{selectedTable || 'No Database Entity Selected'}</div>
                <div style={{ fontSize: '12.5px', color: '#9ca3af', marginTop: 4 }}>
                  {selectedTable ? `${tableTotal.toLocaleString()} structures captured.` : 'Select catalogs to load arbitrary database sheets.'}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setShowRawSql(false)} style={{ ...NeonStyle.btnSecondary, background: !showRawSql ? 'rgba(0, 229, 153, 0.08)' : '#14161a', color: !showRawSql ? '#00e599' : '#9ca3af', borderColor: !showRawSql ? 'rgba(0, 229, 153, 0.2)' : '#2a2d35' }}>Table Grid</button>
                <button onClick={() => setShowRawSql(true)} style={{ ...NeonStyle.btnSecondary, background: showRawSql ? 'rgba(0, 229, 153, 0.08)' : '#14161a', color: showRawSql ? '#00e599' : '#9ca3af', borderColor: showRawSql ? 'rgba(0, 229, 153, 0.2)' : '#2a2d35' }}><TerminalIcon /> Raw SQL Compiler</button>
                
                {selectedTable && !showRawSql && (
                  <>
                    <button onClick={() => loadTableData(selectedTable, tablePage)} style={NeonStyle.btnSecondary} title="Reload records"><RefreshIcon /></button>
                    <button onClick={openAddRow} style={NeonStyle.btnSecondary}><PlusIcon /> Record</button>
                    <button onClick={() => setShowAddColumn(true)} style={NeonStyle.btnSecondary}>Alter Table</button>
                    <button onClick={() => setShowBulkEdit(true)} disabled={selectedIds.size === 0} style={{ ...NeonStyle.btnSecondary, opacity: selectedIds.size === 0 ? 0.5 : 1 }}>Bulk Edit</button>
                    <button onClick={handleDeleteSelected} disabled={selectedIds.size === 0} style={{ ...NeonStyle.btnDanger, opacity: selectedIds.size === 0 ? 0.5 : 1 }}><TrashIcon /> Delete Selected</button>
                    <button onClick={() => handleExport(true)} disabled={selectedIds.size === 0} style={{ ...NeonStyle.btnSecondary, opacity: selectedIds.size === 0 ? 0.5 : 1 }}><ExportIcon /> CSV Extract</button>
                    <button onClick={() => handleExport(false)} style={NeonStyle.btnSecondary}><ExportIcon /> Export All</button>
                    <button onClick={saveTableChanges} disabled={Object.keys(editedCells).length === 0} style={{ ...NeonStyle.btnPrimary, opacity: Object.keys(editedCells).length === 0 ? 0.6 : 1, cursor: Object.keys(editedCells).length === 0 ? 'not-allowed' : 'pointer' }}><SaveIcon /> Save Changes</button>
                  </>
                )}
              </div>
            </div>

            {tableMsg && (
              <div style={{ background: 'rgba(0, 229, 153, 0.05)', border: '1px solid rgba(0, 229, 153, 0.15)', borderRadius: '6px', padding: '10px 14px', color: '#00e599', fontSize: '13px', marginBottom: 16 }}>
                {tableMsg}
              </div>
            )}

            {/* SQL Terminal Interface */}
            {showRawSql ? (
              <div>
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <textarea 
                    value={rawSqlText} 
                    onChange={e => setRawSqlText(e.target.value)} 
                    style={{ 
                      width: '100%', minHeight: '140px', padding: '14px', borderRadius: '8px', 
                      background: '#090a0d', color: '#00e599', border: '1px solid #1f2128',
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '13.5px', outline: 'none'
                    }} 
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <button onClick={() => setRawSqlText('SELECT * FROM users LIMIT 50')} style={NeonStyle.btnSecondary}>Reset Default</button>
                  <button onClick={handleRunRawSql} style={NeonStyle.btnPrimary}><TerminalIcon /> Execute SELECT</button>
                </div>
                
                <div style={{ overflowX: 'auto', border: '1px solid #1f2128', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#0e1013', borderBottom: '1px solid #1f2128' }}>
                        {(sqlCols || []).map(c => <th key={c} style={{ padding: '12px 14px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(sqlRows || []).map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #14161a' }}>
                          {(sqlCols || []).map(col => <td key={col} style={{ padding: '12px 14px', color: '#f3f4f6', fontSize: '13px', fontFamily: '"JetBrains Mono", monospace' }}>{String(r[col] ?? 'NULL')}</td>)}
                        </tr>
                      ))}
                      {sqlRows.length === 0 && (
                        <tr><td style={{ padding: '24px', color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>Execute SELECT operations on terminal prompt above to display results.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              // Table Browse Grid
              selectedTable && (
                <div>
                  
                  {/* SQL Filters Panel */}
                  <div style={{ padding: '16px', background: '#090a0d', border: '1px solid #1f2128', borderRadius: '8px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <select style={{ ...NeonStyle.input, width: '150px' }} value={filterCol} onChange={e => setFilterCol(e.target.value)}>
                        <option value="">Choose Column</option>
                        {(tableSchema.columns || []).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                      
                      <select style={{ ...NeonStyle.input, width: '110px' }} value={filterOp} onChange={e => setFilterOp(e.target.value)}>
                        <option value="=">=</option>
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value=">=">&gt;=</option>
                        <option value="<=">&lt;=</option>
                        <option value="!=">!=</option>
                        <option value="LIKE">LIKE</option>
                        <option value="IS">IS</option>
                        <option value="IS NOT">IS NOT</option>
                      </select>

                      {(() => {
                        const meta = (tableSchema.columns || []).find(c => c.name === filterCol) || {};
                        const t = (meta.type || '').toUpperCase();
                        if (t.includes('INT')) return <input placeholder="Integer Value" style={{ ...NeonStyle.input, width: '160px' }} type="number" value={filterVal} onChange={e => setFilterVal(e.target.value)} />;
                        if (t.includes('BOOL') || filterCol.toLowerCase().startsWith('is_')) return (
                          <select value={filterVal} onChange={e => setFilterVal(e.target.value)} style={{ ...NeonStyle.input, width: '160px' }}>
                            <option value="">NULL</option>
                            <option value="1">TRUE</option>
                            <option value="0">FALSE</option>
                          </select>
                        );
                        return <input placeholder="Target string..." style={{ ...NeonStyle.input, width: '160px' }} value={filterVal} onChange={e => setFilterVal(e.target.value)} />;
                      })()}

                      <select value={filterLogic} onChange={e => setFilterLogic(e.target.value)} style={{ ...NeonStyle.input, width: '80px' }}>
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>

                      <button onClick={() => {
                        if (!filterCol) return;
                        addFilter({ column: filterCol, op: filterOp, value: filterVal });
                        setFilterCol(''); setFilterVal('');
                      }} style={NeonStyle.btnSecondary}>Add</button>
                      
                      <button onClick={applyFilters} style={NeonStyle.btnPrimary}>Apply SQL</button>
                      <button onClick={() => { setFiltersState([]); loadTableData(selectedTable, 1); }} style={NeonStyle.btnDanger}>Clear All</button>
                    </div>

                    {filtersState.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                        {filtersState.map((f, i) => (
                          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#14161a', border: '1px solid #2a2d35', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', color: '#f3f4f6' }}>
                            <code>{f.column} {f.op} "{f.value}"</code>
                            <button onClick={() => removeFilter(i)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: 0 }}>&times;</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Absolute Records Grid */}
                  <div style={{ overflowX: 'auto', border: '1px solid #1f2128', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: tableMinWidth, tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ background: '#0e1013', borderBottom: '1px solid #1f2128' }}>
                          <th style={{ width: '48px', padding: '14px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              onChange={e => {
                                if (e.target.checked) setSelectedIds(new Set(tableRows.map(r => r.id)));
                                else setSelectedIds(new Set());
                              }} 
                              checked={tableRows.length > 0 && selectedIds.size === tableRows.length} 
                              style={{ accentColor: '#00e599', transform: 'scale(1.15)' }}
                            />
                          </th>
                          {tableCols.map(col => (
                            <th 
                              key={col} 
                              onClick={() => handleSortColumn(col)} 
                              style={{ padding: '14px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', cursor: 'pointer', width: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >
                              {col}{sortBy === col ? (sortDir === 'ASC' ? ' ▴' : ' ▾') : ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map(row => (
                          <tr key={row.id} style={{ borderBottom: '1px solid #14161a', transition: 'background-color 0.1s ease' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <td style={{ padding: '14px', textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={selectedIds.has(row.id)} 
                                onChange={e => {
                                  const copy = new Set(selectedIds);
                                  if (e.target.checked) copy.add(row.id); else copy.delete(row.id);
                                  setSelectedIds(copy);
                                }} 
                                style={{ accentColor: '#00e599', transform: 'scale(1.15)' }}
                              />
                            </td>
                            {tableCols.map(col => {
                              const key = `${row.id}::${col}`;
                              const isId = col === 'id';
                              const colMeta = (tableSchema.columns || []).find(c => c.name === col) || {};
                              const type = (colMeta.type || '').toUpperCase();
                              const fk = (tableSchema.foreignKeys || []).find(f => f.from === col);
                              
                              return (
                                <td key={col} style={{ padding: '10px 14px', color: '#f3f4f6', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {isId ? (
                                    <span style={{ color: '#6b7280', fontFamily: '"JetBrains Mono", monospace' }}>{row[col]}</span>
                                  ) : (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      <div style={{ flex: 1 }} onDoubleClick={e => {
                                        const node = e.currentTarget.querySelector('input,select');
                                        if (node) {
                                          node.disabled = false;
                                          node.readOnly = false;
                                          node.focus();
                                        }
                                      }}>
                                        { (type.includes('BOOL') || col.toLowerCase().startsWith('is_')) ? (
                                          <select 
                                            defaultValue={row[col] == null ? '' : String(row[col])} 
                                            disabled 
                                            style={{ width: '100%', background: 'transparent', border: '1px solid transparent', color: '#f3f4f6', outline: 'none', cursor: 'pointer' }} 
                                            onBlur={e => { 
                                              if (String(e.target.value) !== String(row[col])) setEditedCells(prev => ({ ...prev, [key]: e.target.value })); 
                                              e.target.disabled = true; 
                                            }}
                                          >
                                            <option value="">NULL</option>
                                            <option value="1">TRUE</option>
                                            <option value="0">FALSE</option>
                                          </select>
                                        ) : (
                                          <input 
                                            type="text" 
                                            defaultValue={row[col] ?? ''} 
                                            readOnly 
                                            style={{ width: '100%', background: 'transparent', border: '1px solid transparent', color: '#f3f4f6', outline: 'none' }} 
                                            onBlur={e => { 
                                              if (String(e.target.value) !== String(row[col])) setEditedCells(prev => ({ ...prev, [key]: e.target.value })); 
                                              e.target.readOnly = true; 
                                            }} 
                                          />
                                        )}
                                      </div>
                                      {fk && (
                                        <button onClick={() => openFkModal(fk, row[col], row.id, col)} style={{ padding: '4px 8px', borderRadius: '4px', background: '#14161a', color: '#00e599', border: '1px solid rgba(0,229,153,0.15)', cursor: 'pointer', fontSize: '10px' }}>FK</button>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                    <div style={{ color: '#6b7280', fontSize: '13px' }}>Page {tablePage} of {Math.max(1, Math.ceil(tableTotal / tableLimit))}</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => loadTableData(selectedTable, Math.max(1, tablePage - 1))} disabled={tablePage <= 1} style={{ ...NeonStyle.btnSecondary, padding: '6px 12px' }}>Previous</button>
                      <button onClick={() => loadTableData(selectedTable, tablePage + 1)} disabled={tablePage >= Math.ceil(tableTotal / tableLimit)} style={{ ...NeonStyle.btnSecondary, padding: '6px 12px' }}>Next</button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* ── Add Column Modal ────────────────────────────────────────────────── */}
      {showAddColumn && (
        <div style={NeonStyle.modalOverlay}>
          <div style={{ ...NeonStyle.panelCard, width: '100%', maxWidth: '440px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#ffffff' }}>Alter Table Schema: {selectedTable}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 }}>Column Identifier</label>
                <input value={newCol.name} onChange={e => setNewCol(c => ({ ...c, name: e.target.value }))} style={NeonStyle.input} placeholder="e.g. tracking_hash" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 }}>primitive storage class</label>
                <select value={newCol.type} onChange={e => setNewCol(c => ({ ...c, type: e.target.value }))} style={NeonStyle.input}>
                  <option value="TEXT">TEXT</option>
                  <option value="INTEGER">INTEGER</option>
                  <option value="REAL">REAL (FLOAT)</option>
                  <option value="BLOB">BLOB</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 }}>Constraint Nullability</label>
                <select value={newCol.nullable ? '1' : '0'} onChange={e => setNewCol(c => ({ ...c, nullable: e.target.value === '1' }))} style={NeonStyle.input}>
                  <option value="1">ALLOW NULLS (DEFAULT)</option>
                  <option value="0">NOT NULL</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setShowAddColumn(false)} style={NeonStyle.btnSecondary}>Cancel</button>
              <button onClick={handleAddColumn} style={NeonStyle.btnPrimary}>Apply Schema Migration</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Edit Modal ──────────────────────────────────────────────────── */}
      {showBulkEdit && (
        <div style={NeonStyle.modalOverlay}>
          <div style={{ ...NeonStyle.panelCard, width: '100%', maxWidth: '460px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#ffffff' }}>Bulk Execute Update ({selectedIds.size} records selected)</h3>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: '0 0 20px 0' }}>Applies identical parameter values across multiple columns in database.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 }}>Target Column</label>
                <select value={bulkEditColumn} onChange={e => setBulkEditColumn(e.target.value)} style={NeonStyle.input}>
                  <option value="">Choose Column</option>
                  {(tableSchema.columns || []).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 }}>Overwriting Value</label>
                <input value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} style={NeonStyle.input} placeholder="Insert value parameters" />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowBulkEdit(false)} style={NeonStyle.btnSecondary}>Cancel</button>
              <button onClick={handleBulkEdit} style={NeonStyle.btnPrimary}>Execute Write Batch</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Row Modal ────────────────────────────────────────────────────── */}
      {showAddRow && (
        <div style={NeonStyle.modalOverlay}>
          <div style={{ ...NeonStyle.panelCard, width: '100%', maxWidth: '640px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#ffffff' }}>Insert Record: {selectedTable}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxHeight: '420px', overflowY: 'auto', paddingRight: '8px' }}>
              {addRowSchema.map(col => (
                <div key={col.name}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>
                    {col.name} <span style={{ color: '#6b7280', fontSize: '10px' }}>({col.type})</span>
                  </label>
                  <input 
                    type="text" 
                    value={addRowValues[col.name] ?? ''} 
                    onChange={e => setAddRowValues(v => ({ ...v, [col.name]: e.target.value }))} 
                    style={NeonStyle.input} 
                    placeholder="NULL"
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setShowAddRow(false)} style={NeonStyle.btnSecondary}>Cancel</button>
              <button onClick={handleAddRow} style={NeonStyle.btnPrimary}>Commit Record</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Foreign Key Modal ────────────────────────────────────────────────── */}
      {showFkModal && (
        <div style={NeonStyle.modalOverlay}>
          <div style={{ ...NeonStyle.panelCard, width: '100%', maxWidth: '820px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#ffffff' }}>Foreign Key Lookup: {fkModalState.table}</h3>
              <button onClick={closeFkModal} style={NeonStyle.btnSecondary}>Close Table View</button>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid #1f2128', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#0e1013', borderBottom: '1px solid #1f2128' }}>
                    {(fkModalState.cols || []).map(c => <th key={c} style={{ padding: '12px 14px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(fkModalState.rows || []).map((r, i) => (
                    <tr key={i} onClick={() => {
                      const fkTo = fkModalState.fkTo;
                      const targetRow = fkModalState.targetRowId;
                      const targetCol = fkModalState.targetCol;
                      if (fkTo && typeof targetRow !== 'undefined' && targetCol) {
                        const newVal = r[fkTo];
                        setEditedCells(prev => ({ ...prev, [`${targetRow}::${targetCol}`]: newVal }));
                      }
                      setShowFkModal(false);
                    }} style={{ borderBottom: '1px solid #14161a', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0, 229, 153, 0.04)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      {(fkModalState.cols || []).map(col => <td key={col} style={{ padding: '12px 14px', color: '#f3f4f6', fontSize: '13px' }}>{String(r[col] ?? 'NULL')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Password Reset Modal ────────────────────────────────────────────── */}
      {pwModal && (
        <div style={NeonStyle.modalOverlay}>
          <div style={{ ...NeonStyle.panelCard, width: '100%', maxWidth: '400px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#ffffff' }}>Reset Directory Password</h3>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: '0 0 20px 0' }}>Assign fresh session passwords for <strong style={{ color: '#ffffff' }}>{pwModal.name}</strong> ({pwModal.email}).</p>
            
            {pwMsg && (
              <div style={{
                background: pwMsg.includes('updated') ? 'rgba(0, 229, 153, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                border: `1px solid ${pwMsg.includes('updated') ? 'rgba(0, 229, 153, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                borderRadius: '6px', padding: '10px 12px', color: pwMsg.includes('updated') ? '#00e599' : '#f87171', fontSize: '13px', marginBottom: '16px'
              }}>{pwMsg}</div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>Fresh Password Key</label>
              <input type="text" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Minimum 6 characters" style={NeonStyle.input} />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setPwModal(null); setPwMsg(''); }} style={NeonStyle.btnSecondary}>Cancel</button>
              <button onClick={handlePasswordChange} style={NeonStyle.btnPrimary}>Commit Password</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Admin Modal ───────────────────────────────────────────────── */}
      {showCreate && (
        <div style={NeonStyle.modalOverlay}>
          <div style={{ ...NeonStyle.panelCard, width: '100%', maxWidth: '440px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#ffffff' }}>Provision Administrator Console</h3>
            
            {createMsg && (
              <div style={{
                background: createMsg.includes('successfully') ? 'rgba(0, 229, 153, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                border: `1px solid ${createMsg.includes('successfully') ? 'rgba(0, 229, 153, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                borderRadius: '6px', padding: '10px 12px', color: createMsg.includes('successfully') ? '#00e599' : '#f87171', fontSize: '13px', marginBottom: '16px'
              }}>{createMsg}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>Full Name</label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Alexis Carter" style={NeonStyle.input} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>Email Address</label>
                <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. alexis@neon.tech" style={NeonStyle.input} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>Temporary Password</label>
                <input type="text" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 6 characters" style={NeonStyle.input} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>Functional Role Profile</label>
                <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))} style={NeonStyle.input}>
                  <option value="admin">System Administrator</option>
                  <option value="manager">System Manager</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCreate(false); setCreateMsg(''); }} style={NeonStyle.btnSecondary}>Cancel</button>
              <button onClick={handleCreateAdmin} style={NeonStyle.btnPrimary}>Commit Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ────────────────────────────────────────── */}
      {deleteConfirm && (
        <div style={NeonStyle.modalOverlay}>
          <div style={{ ...NeonStyle.panelCard, width: '100%', maxWidth: '400px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#f87171' }}>Purge Record Confirmation</h3>
            <p style={{ color: '#9ca3af', fontSize: '13.5px', lineHeight: '1.5', margin: '0 0 24px 0' }}>
              Are you absolutely sure you want to permanently delete <strong style={{ color: '#ffffff' }}>{deleteConfirm.name}</strong> ({deleteConfirm.email})? 
              This process operates sequentially on databases and cannot be rolled back.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={NeonStyle.btnSecondary}>Abort</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} style={NeonStyle.btnDanger}>Execute Purge</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}