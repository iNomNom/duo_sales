import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const SUPERADMIN_TOKEN_KEY = 'duo_superadmin_token';

// ── Vector Icon Elements ────────────────────────────────────────────────────
const KeyIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3M17 4l3 3"/></svg>
);
const TerminalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
);
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const SaveIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
);
const CancelIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
);
const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="21" y1="9" x2="3" y2="9"/><line x1="21" y1="15" x2="3" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
);

export default function SuperAdmin() {
  const [secretKey, setSecretKey] = useState('');
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(SUPERADMIN_TOKEN_KEY));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Layout selection: 'admins' | 'all-users' | 'tables' | 'sql'
  const [tab, setTab] = useState('tables');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);

  // Data Explorer State
  const [tableList, setTableList] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableCols, setTableCols] = useState([]);
  const [tableRows, setTableRows] = useState([]);
  const [tablePage, setTablePage] = useState(1);
  const [tableLimit, setTableLimit] = useState(15);
  const [tableTotal, setTableTotal] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableMsg, setTableMsg] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('ASC');
  const [tableSearch, setTableSearch] = useState('');

  // Embedded Interactive Spreadsheet States
  const [hoveredCell, setHoveredCell] = useState(null); // { rowId, colName }
  const [focusedCell, setFocusedCell] = useState(null); // { rowId, colName }
  const [editingCell, setEditingCell] = useState(null); // { rowId, colName }
  const [editValue, setEditValue] = useState('');
  const [editedCells, setEditedCells] = useState({}); // Stores unsaved edits: { 'rowId::colName': val }
  const cellInputRef = useRef(null);

  // Filters State
  const [filtersState, setFiltersState] = useState([]);
  const [filterCol, setFilterCol] = useState('');
  const [filterOp, setFilterOp] = useState('=');
  const [filterVal, setFilterVal] = useState('');
  const [tableSchema, setTableSchema] = useState({ columns: [], foreignKeys: [] });

  // Custom modals
  const [showAddRow, setShowAddRow] = useState(false);
  const [addRowSchema, setAddRowSchema] = useState([]);
  const [addRowValues, setAddRowValues] = useState({});
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newCol, setNewCol] = useState({ name: '', type: 'TEXT', nullable: true });
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditColumn, setBulkEditColumn] = useState('');
  const [bulkEditValue, setBulkEditValue] = useState('');

  // Compiler Console
  const [rawSqlText, setRawSqlText] = useState('SELECT * FROM users LIMIT 10');
  const [sqlRows, setSqlRows] = useState([]);
  const [sqlCols, setSqlCols] = useState([]);

  // Directory Control Modals
  const [pwModal, setPwModal] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [createMsg, setCreateMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Dynamic Focus States for inputs (removes the need for a separate CSS file)
  const [activeFocusField, setActiveFocusField] = useState(null);
  const [sidebarHover, setSidebarHover] = useState(null);

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
      setError(err.response?.data?.error || 'Master Key Verification Aborted.');
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
        setError('Session token rejected. verification required.');
      }
    }
  };

  const loadTableList = async () => {
    try {
      const res = await axios.get('/api/superadmin/sql/tables', getAuthHeader());
      setTableList(res.data.tables);
      if (res.data.tables.length > 0 && !selectedTable) {
        setSelectedTable(res.data.tables[0]);
      }
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Schema validation failure');
    }
  };

  const loadTableData = async (table, page = 1, sortByParam = null, sortDirParam = null) => {
    if (!table) return;
    setTableLoading(true);
    setTableMsg('');
    try {
      const params = { page, limit: tableLimit };
      if (filtersState && filtersState.length) params.filters = JSON.stringify(filtersState);
      const activeSortBy = sortByParam !== null ? sortByParam : sortBy;
      const activeSortDir = sortDirParam !== null ? sortDirParam : sortDir;
      if (activeSortBy) {
        params.sortBy = activeSortBy;
        params.sortDir = activeSortDir;
      }
      const res = await axios.get(`/api/superadmin/sql/table/${table}`, { params, ...getAuthHeader() });
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
      setTableMsg(err.response?.data?.error || 'Failure to unpack table catalog.');
    } finally {
      setTableLoading(false);
    }
  };

  const saveTableChanges = async () => {
    const changes = Object.entries(editedCells).map(([key, value]) => {
      const [id, column] = key.split('::');
      return { id: Number(id), column, value };
    });
    if (changes.length === 0) {
      setTableMsg('No cell modifications pending write.');
      return;
    }
    try {
      const res = await axios.post(`/api/superadmin/sql/table/${selectedTable}/save`, { changes }, getAuthHeader());
      setTableMsg(res.data.message || 'Changes saved successfully.');
      setEditedCells({});
      loadTableData(selectedTable, tablePage);
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Pipeline write execution rejected.');
    }
  };

  const handleExport = async () => {
    try {
      const url = `/api/superadmin/sql/table/${selectedTable}/export`;
      const res = await axios.get(url, { responseType: 'blob', ...getAuthHeader() });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `${selectedTable}_dump.csv`;
      link.click();
      setTableMsg('Dump stream processed successfully.');
    } catch (err) {
      setTableMsg('Export rejected by target file-system.');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Drop selected ${selectedIds.size} row(s)?`)) return;
    try {
      const ids = Array.from(selectedIds);
      const res = await axios.post(`/api/superadmin/sql/table/${selectedTable}/delete`, { ids }, getAuthHeader());
      setTableMsg(`${res.data.changes || 0} structures successfully purged.`);
      loadTableData(selectedTable, tablePage);
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Database constraint deletion conflict.');
    }
  };

  const openAddRow = async () => {
    try {
      const res = await axios.get(`/api/superadmin/sql/table/${selectedTable}/schema`, getAuthHeader());
      setAddRowSchema(res.data.columns || []);
      const defaults = {};
      (res.data.columns || []).forEach(c => { defaults[c.name] = ''; });
      setAddRowValues(defaults);
      setShowAddRow(true);
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Schema validation error.');
    }
  };

  const handleAddRow = async () => {
    try {
      await axios.post(`/api/superadmin/sql/table/${selectedTable}/add-row`, { values: addRowValues }, getAuthHeader());
      setShowAddRow(false);
      loadTableData(selectedTable, 1);
      setTableMsg('Record persisted successfully.');
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Database integrity assertion failure.');
    }
  };

  const handleAddColumn = async () => {
    try {
      await axios.post(`/api/superadmin/sql/table/${selectedTable}/add-column`, { name: newCol.name, type: newCol.type, nullable: newCol.nullable }, getAuthHeader());
      setShowAddColumn(false);
      setNewCol({ name: '', type: 'TEXT', nullable: true });
      loadTableData(selectedTable, 1);
      setTableMsg('Alteration executed successfully.');
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Table structural migration failure.');
    }
  };

  const handleBulkEdit = async () => {
    try {
      const ids = Array.from(selectedIds);
      const changes = { [bulkEditColumn]: bulkEditValue };
      await axios.post(`/api/superadmin/sql/table/${selectedTable}/bulk-update`, { ids, changes }, getAuthHeader());
      setShowBulkEdit(false);
      setBulkEditColumn(''); 
      setBulkEditValue('');
      loadTableData(selectedTable, tablePage);
      setTableMsg('Batch processing writes committed.');
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Transaction engine error.');
    }
  };

  const handleRunRawSql = async () => {
    try {
      const res = await axios.post('/api/superadmin/sql/execute', { sql: rawSqlText }, getAuthHeader());
      const rows = res.data.rows || [];
      setSqlRows(rows);
      setSqlCols(rows.length ? Object.keys(rows[0]) : []);
      setTableMsg('Query execution finalized.');
    } catch (err) {
      setTableMsg(err.response?.data?.error || 'Compiler engine mismatch.');
    }
  };

  const handlePasswordChange = async () => {
    if (!newPw || newPw.length < 6) { setPwMsg('Length restriction error.'); return; }
    try {
      const res = await axios.put(`/api/superadmin/users/${pwModal.id}/password`, { newPassword: newPw }, getAuthHeader());
      setPwMsg(res.data.message);
      setNewPw('');
      setTimeout(() => { setPwModal(null); setPwMsg(''); loadData(); }, 1500);
    } catch (err) {
      setPwMsg(err.response?.data?.error || 'Aborted.');
    }
  };

  const handleCreateAdmin = async () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      setCreateMsg('All structures are required.');
      return;
    }
    try {
      const res = await axios.post('/api/superadmin/admins', createForm, getAuthHeader());
      setCreateMsg(res.data.message);
      setCreateForm({ name: '', email: '', password: '', role: 'admin' });
      setTimeout(() => { setShowCreate(false); setCreateMsg(''); loadData(); }, 1500);
    } catch (err) {
      setCreateMsg(err.response?.data?.error || 'Account persistence mismatch.');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await axios.delete(`/api/superadmin/users/${userId}`, getAuthHeader());
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Identity deletion aborted.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SUPERADMIN_TOKEN_KEY);
    setAuthed(false);
    setDataLoaded(false);
  };

  // ── Cell Editing Engine ──────────────────────────────────────────────────
  const startEditing = (rowId, colName, currentValue) => {
    setEditingCell({ rowId, colName });
    const trackingKey = `${rowId}::${colName}`;
    setEditValue(editedCells[trackingKey] !== undefined ? editedCells[trackingKey] : (currentValue ?? ''));
    setTimeout(() => {
      if (cellInputRef.current) cellInputRef.current.focus();
    }, 50);
  };

  const commitCellEdit = () => {
    if (!editingCell) return;
    const { rowId, colName } = editingCell;
    const trackingKey = `${rowId}::${colName}`;

    const originalRow = tableRows.find(r => r.id === rowId);
    const originalValue = originalRow ? originalRow[colName] : undefined;

    if (String(editValue) !== String(originalValue ?? '')) {
      setEditedCells(prev => ({ ...prev, [trackingKey]: editValue }));
    } else {
      setEditedCells(prev => {
        const next = { ...prev };
        delete next[trackingKey];
        return next;
      });
    }
    setEditingCell(null);
  };

  const cancelCellEdit = () => setEditingCell(null);

  useEffect(() => {
    if (authed) {
      if (!dataLoaded) loadData();
      loadTableList();
    }
  }, [authed]);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable, 1);
    }
  }, [selectedTable]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (editingCell && cellInputRef.current && !cellInputRef.current.contains(e.target)) {
        commitCellEdit();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [editingCell, editValue]);

  // ── Theme Style Matrix (Supabase / Neon Design Language) ────────────────
  const styles = {
    wrapper: {
      backgroundColor: '#141414',
      color: '#dedede',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    banner: {
      backgroundColor: '#2e0a0d',
      borderBottom: '1px solid #7f1d1d',
      color: '#FCE3EB',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '12.5px',
      zIndex: 10
    },
    bannerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    bannerTag: {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      border: '1px solid rgba(239, 68, 68, 0.4)',
      color: '#fca5a5',
      padding: '2px 6px',
      borderRadius: '4px',
      fontWeight: '700',
      fontSize: '10px',
      letterSpacing: '0.05em'
    },
    header: {
      backgroundColor: '#111111',
      borderBottom: '1px solid #2e2e2e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      height: '56px',
      flexShrink: 0
    },
    breadcrumbs: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '13.5px'
    },
    badge: {
      backgroundColor: '#2a2a2a',
      color: '#34D59A',
      fontSize: '10px',
      fontWeight: '600',
      padding: '2px 6px',
      borderRadius: '4px',
      border: '1px solid rgba(52, 213, 154, 0.2)',
      textTransform: 'uppercase'
    },
    layoutBody: {
      display: 'flex',
      flex: 1,
      overflow: 'hidden'
    },
    sidebar: {
      width: '240px',
      backgroundColor: '#141414',
      borderRight: '1px solid #2e2e2e',
      padding: '20px 8px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      flexShrink: 0
    },
    catalogSidebar: {
      width: '250px',
      borderRight: '1px solid #2e2e2e',
      backgroundColor: '#111111',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0
    },
    searchBox: {
      display: 'flex',
      alignItems: 'center',
      padding: '12px',
      borderBottom: '1px solid #2e2e2e',
      gap: '8px',
      color: '#888888'
    },
    searchInput: {
      background: 'transparent',
      border: 'none',
      color: '#fff',
      fontSize: '13px',
      outline: 'none',
      width: '100%'
    },
    catalogItems: {
      flex: 1,
      overflowY: 'auto',
      padding: '8px'
    },
    workspace: {
      flex: 1,
      backgroundColor: '#191919',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    },
    toolbar: {
      height: '56px',
      borderBottom: '1px solid #2e2e2e',
      backgroundColor: '#111111',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      flexShrink: 0
    },
    btnAccent: {
      backgroundColor: '#34D59A',
      color: '#111111',
      border: 'none',
      padding: '8px 14px',
      borderRadius: '4px',
      fontWeight: '600',
      fontSize: '13px',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    },
    btnSecondary: {
      backgroundColor: '#222222',
      border: '1px solid #2e2e2e',
      color: '#dedede',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '13px',
      cursor: 'pointer'
    },
    queryBuilder: {
      backgroundColor: '#111111',
      borderBottom: '1px solid #2e2e2e',
      padding: '10px 20px',
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    tableWrapper: {
      flex: 1,
      overflow: 'auto'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: '12.5px'
    },
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 5, 5, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px'
    },
    modalCard: {
      backgroundColor: '#141414',
      border: '1px solid #2e2e2e',
      borderRadius: '12px',
      padding: '24px',
      width: '100%',
      maxWidth: '460px',
      boxShadow: '0 20px 80px rgba(0,0,0,0.6)'
    }
  };

  const filteredTablesList = tableList.filter(t => t.toLowerCase().includes(tableSearch.toLowerCase()));

  // ── Verification Protection Page View ──────────────────────────────────
  if (!authed) {
    return (
      <div style={{ ...styles.wrapper, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundImage: 'radial-gradient(circle at top, rgba(52, 213, 154, 0.04) 0%, transparent 50%)', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#111111', border: '1px solid #2e2e2e', borderRadius: '12px', padding: '36px', textAlign: 'center', boxShadow: '0 20px 80px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', backgroundColor: 'rgba(52, 213, 154, 0.1)', border: '1px solid rgba(52, 213, 154, 0.3)', padding: '12px', borderRadius: '12px', boxShadow: '0 0 24px rgba(52, 213, 154, 0.2)' }}>
            <svg width="24" height="24" viewBox="0 0 58 58" fill="none"><path d="M58 0.016V58L35.369 38.559V58H0V0L58 0.016zM7.11 50.96h21.15V23.111l22.631 19.826V7.054L7.11 7.042v43.918z" fill="#34D59A"/></svg>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>Decrypt Console Terminal</h1>
          <p style={{ fontSize: '13.5px', color: '#888888', lineHeight: '1.5', marginBottom: '30px' }}>Verify decryption credentials to access memory instances.</p>
          
          {error && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontSize: '13px', padding: '10px 14px', borderRadius: '6px', marginBottom: '20px', textAlign: 'left' }}>{error}</div>}
          
          <form onSubmit={handleVerify}>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', marginBottom: '24px' }}>
              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888888', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: '700' }}>Terminal Secret Key</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '14px', color: '#888888', display: 'flex', alignItems: 'center' }}><KeyIcon /></span>
                <input 
                  type="password" 
                  value={secretKey} 
                  onChange={e => setSecretKey(e.target.value)} 
                  placeholder="••••••••••••" 
                  required 
                  onFocus={() => setActiveFocusField('login')}
                  onBlur={() => setActiveFocusField(null)}
                  style={{
                    backgroundColor: '#191919',
                    border: '1px solid #2e2e2e',
                    borderColor: activeFocusField === 'login' ? '#34D59A' : '#2e2e2e',
                    boxShadow: activeFocusField === 'login' ? '0 0 12px rgba(52, 213, 154, 0.15)' : 'none',
                    color: '#fff',
                    fontSize: '14px',
                    padding: '12px 14px 12px 42px',
                    borderRadius: '6px',
                    outline: 'none',
                    width: '100%',
                    transition: 'all 0.15s ease'
                  }}
                />
              </div>
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', backgroundColor: '#34D59A', color: '#111', fontWeight: '700', border: 'none', fontSize: '14px', padding: '12px', borderRadius: '6px', cursor: 'pointer' }}>
              {loading ? 'Initializing Decryption...' : 'Connect to Instance'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Standard Master Console Terminal View ────────────────────────────────
  return (
    <div style={styles.wrapper}>
      
      {/* Dynamic Master State Banner */}
      <div style={styles.banner}>
        <div style={styles.bannerLeft}>
          <span style={styles.bannerTag}>SQL ENGINE</span>
          <span>Operations write dynamically. Unsaved modifications: <strong>{Object.entries(editedCells).length}</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {Object.entries(editedCells).length > 0 && (
            <button onClick={saveTableChanges} style={{ backgroundColor: '#34D59A', color: '#111', border: 'none', fontSize: '11px', fontWeight: '700', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}>
              Save Changes
            </button>
          )}
        </div>
      </div>

      {/* Main breadcrumb header */}
      <header style={styles.header}>
        <div style={styles.breadcrumbs}>
          <svg width="20" height="20" viewBox="0 0 58 58" fill="none"><path d="M58 0.016V58L35.369 38.559V58H0V0L58 0.016zM7.11 50.96h21.15V23.111l22.631 19.826V7.054L7.11 7.042v43.918z" fill="#34D59A"/></svg>
          <span style={{ color: '#555555' }}>/</span>
          <span>Noman Console</span>
          <span style={styles.badge}>Live</span>
          <span style={{ color: '#555555' }}>/</span>
          <span style={{ fontWeight: '600', color: '#fff' }}>Tables Workspace</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '12px', color: '#34D59A' }}>● Terminal Operational</span>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid #2e2e2e', color: '#dedede', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Exit Terminal</button>
        </div>
      </header>

      <div style={styles.layoutBody}>
        
        {/* Navigation Sidebar panel */}
        <aside style={styles.sidebar}>
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#888888', letterSpacing: '0.1em', paddingLeft: '10px', marginBottom: '8px', fontWeight: '700' }}>System Config</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '24px' }}>
              <button onClick={() => setTab('admins')} style={{ display: 'block', width: '100%', textAlign: 'left', background: tab === 'admins' ? 'rgba(255,255,255,0.06)' : 'transparent', border: 'none', color: tab === 'admins' ? '#34D59A' : '#999', padding: '8px 12px', fontSize: '13.5px', borderRadius: '6px', cursor: 'pointer', fontWeight: tab === 'admins' ? '600' : '400' }}>Admins & Managers</button>
              <button onClick={() => setTab('all-users')} style={{ display: 'block', width: '100%', textAlign: 'left', background: tab === 'all-users' ? 'rgba(255,255,255,0.06)' : 'transparent', border: 'none', color: tab === 'all-users' ? '#34D59A' : '#999', padding: '8px 12px', fontSize: '13.5px', borderRadius: '6px', cursor: 'pointer', fontWeight: tab === 'all-users' ? '600' : '400' }}>Directory Users</button>
            </div>

            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#888888', letterSpacing: '0.1em', paddingLeft: '10px', marginBottom: '8px', fontWeight: '700' }}>Database Engine</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button onClick={() => setTab('tables')} style={{ display: 'block', width: '100%', textAlign: 'left', background: tab === 'tables' ? 'rgba(255,255,255,0.06)' : 'transparent', border: 'none', color: tab === 'tables' ? '#34D59A' : '#999', padding: '8px 12px', fontSize: '13.5px', borderRadius: '6px', cursor: 'pointer', fontWeight: tab === 'tables' ? '600' : '400' }}>Tables Data Explorer</button>
              <button onClick={() => setTab('sql')} style={{ display: 'block', width: '100%', textAlign: 'left', background: tab === 'sql' ? 'rgba(255,255,255,0.06)' : 'transparent', border: 'none', color: tab === 'sql' ? '#34D59A' : '#999', padding: '8px 12px', fontSize: '13.5px', borderRadius: '6px', cursor: 'pointer', fontWeight: tab === 'sql' ? '600' : '400' }}>SQL Terminal Console</button>
            </div>
          </div>
          
          <div style={{ backgroundColor: '#111111', border: '1px solid #2e2e2e', padding: '12px', borderRadius: '6px', fontSize: '12px' }}>
            <h4 style={{ color: '#fff', fontSize: '12.5px', marginBottom: '4px', margin: 0 }}>SQLite Controller</h4>
            <p style={{ color: '#888888', margin: '4px 0 0 0', lineHeight: '1.4' }}>Bypassing standard REST constraints allows direct database manipulations.</p>
          </div>
        </aside>

        {/* Database catalog middle sidebar (visible only inside catalog view) */}
        {tab === 'tables' && (
          <aside style={styles.catalogSidebar}>
            <div style={styles.searchBox}>
              <SearchIcon />
              <input type="text" placeholder="Search schema..." value={tableSearch} onChange={e => setTableSearch(e.target.value)} style={styles.searchInput} />
            </div>
            <div style={styles.catalogItems}>
              {filteredTablesList.map(tbl => (
                <div 
                  key={tbl} 
                  onClick={() => setSelectedTable(tbl)} 
                  onMouseEnter={() => setSidebarHover(tbl)}
                  onMouseLeave={() => setSidebarHover(null)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: selectedTable === tbl ? '#fff' : '#999',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: selectedTable === tbl ? 'rgba(255,255,255,0.05)' : (sidebarHover === tbl ? 'rgba(255,255,255,0.02)' : 'transparent'),
                    borderLeft: selectedTable === tbl ? '2px solid #34D59A' : '2px solid transparent',
                    borderRadius: selectedTable === tbl ? '0 6px 6px 0' : '6px',
                    transition: 'all 0.1s ease',
                    fontWeight: selectedTable === tbl ? '600' : '400'
                  }}
                >
                  <GridIcon />
                  <span>{tbl}</span>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Primary Interactive Workspace */}
        <main style={styles.workspace}>
          
          {/* Active Tab Workspace: Tables Explorer */}
          {tab === 'tables' && selectedTable && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              
              {/* Dynamic Toolbar */}
              <div style={styles.toolbar}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={styles.currentTableBadge}>{selectedTable}</span>
                  <span style={{ fontSize: '11.5px', color: '#888888', backgroundColor: '#222', padding: '2px 6px', borderRadius: '4px', marginLeft: '12px' }}>{tableTotal} records matching</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={openAddRow} style={styles.btnAccent}>+ Insert Record</button>
                  <button onClick={() => setShowAddColumn(true)} style={styles.btnSecondary}>Add Column</button>
                  <button onClick={() => setShowBulkEdit(true)} disabled={selectedIds.size === 0} style={{ ...styles.btnSecondary, opacity: selectedIds.size === 0 ? 0.4 : 1 }}>Bulk Edit</button>
                  <button onClick={handleDeleteSelected} disabled={selectedIds.size === 0} style={{ ...styles.btnSecondary, color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.2)', opacity: selectedIds.size === 0 ? 0.4 : 1 }}>Drop Records</button>
                  <button onClick={handleExport} style={styles.btnSecondary}>CSV Extract</button>
                </div>
              </div>

              {/* Filtering layout parameters */}
              <div style={styles.queryBuilder}>
                <select value={filterCol} onChange={e => setFilterCol(e.target.value)} style={{ ...styles.searchInput, width: '180px', backgroundColor: '#141414', border: '1px solid #2e2e2e', padding: '6px 10px', borderRadius: '4px' }}>
                  <option value="">Match Column...</option>
                  {(tableSchema.columns || []).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <select value={filterOp} onChange={e => setFilterOp(e.target.value)} style={{ ...styles.searchInput, width: '100px', backgroundColor: '#141414', border: '1px solid #2e2e2e', padding: '6px 10px', borderRadius: '4px' }}>
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value="LIKE">LIKE</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                </select>
                <input type="text" placeholder="Filtering value match string..." value={filterVal} onChange={e => setFilterVal(e.target.value)} style={{ ...styles.searchInput, flex: 1, backgroundColor: '#141414', border: '1px solid #2e2e2e', padding: '6px 10px', borderRadius: '4px' }} />
                <button onClick={() => {
                  if (!filterCol) return;
                  setFiltersState([...filtersState, { column: filterCol, op: filterOp, value: filterVal }]);
                  setFilterCol(''); setFilterVal('');
                }} style={styles.btnSecondary}>Add Filter</button>
                <button onClick={() => loadTableData(selectedTable, 1)} style={styles.btnAccent}>Match Schema</button>
                <button onClick={() => { setFiltersState([]); loadTableData(selectedTable, 1); }} style={{ ...styles.btnSecondary, color: '#f87171' }}>Reset</button>
              </div>

              {/* Dynamic Filter conditions container */}
              {filtersState.length > 0 && (
                <div style={{ backgroundColor: '#111111', padding: '8px 20px', borderBottom: '1px solid #2e2e2e', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {filtersState.map((f, i) => (
                    <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#191919', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '4px 10px', fontSize: '12px' }}>
                      <span style={{ color: '#888888' }}>{f.column} {f.op}</span>
                      <strong style={{ color: '#34D59A' }}>"{f.value}"</strong>
                      <span onClick={() => setFiltersState(filtersState.filter((_, idx) => idx !== i))} style={{ cursor: 'pointer', color: '#ef4444', marginLeft: '6px' }}>&times;</span>
                    </div>
                  ))}
                </div>
              )}

              {/* High-Fidelity Spreadsheet Data Grid View */}
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr style={{ background: '#111111', borderBottom: '1px solid #2e2e2e' }}>
                      <th style={{ width: '40px', textAlign: 'center', padding: '12px', borderRight: '1px solid #2e2e2e' }}>
                        <input 
                          type="checkbox" 
                          onChange={e => {
                            if (e.target.checked) setSelectedIds(new Set(tableRows.map(r => r.id)));
                            else setSelectedIds(new Set());
                          }} 
                          checked={tableRows.length > 0 && selectedIds.size === tableRows.length} 
                          style={{ accentColor: '#34D59A', transform: 'scale(1.1)' }}
                        />
                      </th>
                      {tableCols.map(col => (
                        <th key={col} onClick={() => {
                          const nextDir = sortBy === col && sortDir === 'ASC' ? 'DESC' : 'ASC';
                          setSortBy(col); setSortDir(nextDir);
                          loadTableData(selectedTable, tablePage, col, nextDir);
                        }} style={{ padding: '12px 16px', color: '#888888', borderRight: '1px solid #2e2e2e', cursor: 'pointer', userSelect: 'none', fontWeight: '500', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {col} <span style={{ color: '#555555', fontSize: '9.5px', marginLeft: '4px' }}>{tableSchema.columns.find(c => c.name === col)?.type || 'class'}</span>
                          {sortBy === col && (sortDir === 'ASC' ? ' ▴' : ' ▾')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(row => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #2e2e2e' }}>
                        <td style={{ textAlign: 'center', padding: '12px', borderRight: '1px solid #2e2e2e' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedIds.has(row.id)} 
                            onChange={e => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(row.id); else next.delete(row.id);
                              setSelectedIds(next);
                            }} 
                            style={{ accentColor: '#34D59A', transform: 'scale(1.1)' }}
                          />
                        </td>
                        {tableCols.map(col => {
                          const isId = col === 'id';
                          const isEditing = editingCell && editingCell.rowId === row.id && editingCell.colName === col;
                          const isFocused = focusedCell && focusedCell.rowId === row.id && focusedCell.colName === col;
                          const trackingKey = `${row.id}::${col}`;
                          const isDirty = editedCells[trackingKey] !== undefined;
                          const displayValue = isDirty ? editedCells[trackingKey] : row[col];
                          const cellHovered = hoveredCell && hoveredCell.rowId === row.id && hoveredCell.colName === col;

                          return (
                            <td 
                              key={col} 
                              onMouseEnter={() => !isId && setHoveredCell({ rowId: row.id, colName: col })}
                              onMouseLeave={() => setHoveredCell(null)}
                              onClick={() => !isId && setFocusedCell({ rowId: row.id, colName: col })}
                              onDoubleClick={() => !isId && startEditing(row.id, col, row[col])}
                              style={{
                                borderRight: '1px solid #2e2e2e',
                                position: 'relative',
                                height: '40px',
                                padding: 0,
                                outline: isFocused ? '2px solid #34D59A' : 'none',
                                outlineOffset: '-2px',
                                zIndex: isFocused ? 5 : 1,
                                backgroundColor: isDirty ? 'rgba(245, 158, 11, 0.04)' : 'transparent',
                                cursor: isId ? 'default' : 'cell',
                                transition: 'all 0.1s ease'
                              }}
                            >
                              {/* Unsaved data corner flag */}
                              {isDirty && !isEditing && (
                                <div style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '5px 5px 0 0', borderColor: '#f59e0b transparent transparent transparent' }} />
                              )}

                              {isEditing ? (
                                <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, background: '#090a0d', zIndex: 10, boxShadow: 'inset 0 0 0 2px #34D59A' }}>
                                  <input 
                                    ref={cellInputRef}
                                    type="text" 
                                    value={editValue} 
                                    onChange={e => setEditValue(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') commitCellEdit();
                                      if (e.key === 'Escape') cancelCellEdit();
                                    }}
                                    style={{ flex: 1, height: '100%', background: 'transparent', border: 'none', color: '#fff', fontFamily: '"JetBrains Mono", monospace', fontSize: '12.5px', padding: '0 14px', outline: 'none' }}
                                  />
                                  <div style={{ display: 'flex', gap: '3px', paddingRight: '8px' }}>
                                    <button onClick={commitCellEdit} style={{ width: '22px', height: '22px', borderRadius: '4px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#34D59A', color: '#111', cursor: 'pointer' }}><SaveIcon /></button>
                                    <button onClick={cancelCellEdit} style={{ width: '22px', height: '22px', borderRadius: '4px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#222', color: '#888', cursor: 'pointer' }}><CancelIcon /></button>
                                  </div>
                                  <div style={{ position: 'absolute', bottom: '-22px', left: 0, backgroundColor: '#090a0d', color: '#888', fontFamily: 'sans-serif', fontSize: '9px', padding: '2px 6px', border: '1px solid #2e2e2e', borderTop: 'none', borderRadius: '0 0 4px 4px', whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>Press Enter ↵ to commit, Esc to cancel</div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '100%', padding: '10px 14px', boxSizing: 'border-box' }}>
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, color: displayValue === null ? '#555' : 'inherit', fontStyle: displayValue === null ? 'italic' : 'normal' }}>
                                    {displayValue === null ? 'NULL' : String(displayValue)}
                                  </span>
                                  {!isId && (cellHovered || isFocused) && (
                                    <button 
                                      onClick={() => startEditing(row.id, col, row[col])} 
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222', border: '1px solid #2e2e2e', color: '#888', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer', padding: 0 }}
                                      title="Edit Value"
                                    >
                                      <EditIcon />
                                    </button>
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

              {/* Data explorer footer pagination control */}
              <div style={{ backgroundColor: '#111111', borderTop: '1px solid #2e2e2e', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#888888', flexShrink: 0 }}>
                <span>Page {tablePage} of {Math.max(1, Math.ceil(tableTotal / tableLimit))}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => loadTableData(selectedTable, Math.max(1, tablePage - 1))} disabled={tablePage <= 1} style={{ ...styles.btnSecondary, padding: '6px 12px', opacity: tablePage <= 1 ? 0.4 : 1 }}>Prev</button>
                  <button onClick={() => loadTableData(selectedTable, tablePage + 1)} disabled={tablePage >= Math.ceil(tableTotal / tableLimit)} style={{ ...styles.btnSecondary, padding: '6px 12px', opacity: tablePage >= Math.ceil(tableTotal / tableLimit) ? 0.4 : 1 }}>Next</button>
                </div>
              </div>

            </div>
          )}

          {/* User Directory Tab Views */}
          {(tab === 'admins' || tab === 'all-users') && (
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', margin: 0 }}>{tab === 'admins' ? 'Administrators & Managers Workspace' : 'All Workspace Profiles'}</h2>
                {tab === 'admins' && (
                  <button onClick={() => setShowCreate(true)} style={styles.btnAccent}>+ Provision Account</button>
                )}
              </div>

              <div style={{ border: '1px solid #2e2e2e', backgroundColor: '#111111', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                  <thead>
                    <tr style={{ background: '#161616', borderBottom: '1px solid #2e2e2e' }}>
                      <th style={{ padding: '14px 18px', color: '#888888', fontWeight: '500' }}>Name</th>
                      <th style={{ padding: '14px 18px', color: '#888888', fontWeight: '500' }}>Email ID</th>
                      <th style={{ padding: '14px 18px', color: '#888888', fontWeight: '500' }}>Permission Scope</th>
                      <th style={{ padding: '14px 18px', color: '#888888', fontWeight: '500' }}>Billing Activation</th>
                      <th style={{ padding: '14px 18px', color: '#888888', fontWeight: '500' }}>Registration Date</th>
                      <th style={{ padding: '14px 18px', color: '#888888', fontWeight: '500', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tab === 'admins' ? admins : users).map(usr => (
                      <tr key={usr.id} style={{ borderBottom: '1px solid #222222' }}>
                        <td style={{ padding: '14px 18px', color: '#fff', fontWeight: '500' }}>{usr.name}</td>
                        <td style={{ padding: '14px 18px', color: '#999' }}>{usr.email}</td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase',
                            background: usr.role === 'admin' ? 'rgba(52, 213, 154, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                            color: usr.role === 'admin' ? '#34D59A' : '#3b82f6',
                            border: `1px solid ${usr.role === 'admin' ? 'rgba(52, 213, 154, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`
                          }}>{usr.role}</span>
                        </td>
                        <td style={{ padding: '14px 18px', color: '#999' }}>Day {usr.sales_cycle_start} of month</td>
                        <td style={{ padding: '14px 18px', color: '#666' }}>{usr.created_at ? new Date(usr.created_at).toLocaleDateString() : 'N/A'}</td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <button onClick={() => { setPwModal(usr); setNewPw(''); setPwMsg(''); }} style={{ ...styles.btnSecondary, marginRight: '8px', padding: '6px 10px', fontSize: '12px' }}>Reset Password</button>
                          <button onClick={() => setDeleteConfirm(usr)} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Raw SQL compiler Terminal panel view */}
          {tab === 'sql' && (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', margin: 0 }}>Playground Arbitrary Read Compiler</h2>
                <button onClick={handleRunRawSql} style={styles.btnAccent}><TerminalIcon /> Execute SELECT Compiler</button>
              </div>

              <div style={{ border: '1px solid #2e2e2e', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                <textarea 
                  value={rawSqlText} 
                  onChange={e => setRawSqlText(e.target.value)} 
                  style={{ width: '100%', height: '140px', backgroundColor: '#111111', border: 'none', outline: 'none', color: '#34D59A', fontFamily: '"JetBrains Mono", monospace', fontSize: '13.5px', padding: '16px', lineHeight: '1.5', resize: 'vertical' }}
                  placeholder="SELECT * FROM users LIMIT 10;"
                />
              </div>

              <div style={{ flex: 1, marginTop: '24px', border: '1px solid #2e2e2e', backgroundColor: '#111111', borderRadius: '8px', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px', fontFamily: '"JetBrains Mono", monospace' }}>
                  <thead>
                    <tr style={{ background: '#161616', borderBottom: '1px solid #2e2e2e' }}>
                      {sqlCols.map(c => <th key={c} style={{ padding: '12px 14px', color: '#888888' }}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {sqlRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #222222' }}>
                        {sqlCols.map(c => <td key={c} style={{ padding: '12px 14px', color: '#fff' }}>{String(r[c] ?? 'NULL')}</td>)}
                      </tr>
                    ))}
                    {sqlRows.length === 0 && (
                      <tr>
                        <td colSpan={100} style={{ padding: '48px', color: '#666', textAlign: 'center', fontFamily: 'sans-serif' }}>Execute database select queries above. Writes are prohibited.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── Alter Table Schema Modal ────────────────────────────────────────── */}
      {showAddColumn && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>Schema Migration Tool</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888888', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: '700' }}>Column Identifier Name</label>
                <input type="text" value={newCol.name} onChange={e => setNewCol({ ...newCol, name: e.target.value })} placeholder="e.g. storage_hash" style={{ backgroundColor: '#191919', border: '1px solid #2e2e2e', color: '#fff', fontSize: '13.5px', padding: '10px 14px', borderRadius: '6px', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888888', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: '700' }}>Primitive Datatype</label>
                <select value={newCol.type} onChange={e => setNewCol({ ...newCol, type: e.target.value })} style={{ backgroundColor: '#191919', border: '1px solid #2e2e2e', color: '#fff', fontSize: '13.5px', padding: '10px 14px', borderRadius: '6px', outline: 'none' }}>
                  <option value="TEXT">TEXT</option>
                  <option value="INTEGER">INTEGER</option>
                  <option value="REAL">REAL (FLOAT)</option>
                  <option value="BLOB">BLOB</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setShowAddColumn(false)} style={styles.btnSecondary}>Cancel</button>
              <button onClick={handleAddColumn} style={styles.btnAccent}>Apply Column Migration</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Edit Modal ─────────────────────────────────────────────────── */}
      {showBulkEdit && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#fff' }}>Bulk Write Operation ({selectedIds.size} lines)</h3>
            <p style={{ color: '#888888', fontSize: '13px', margin: '0 0 20px 0' }}>Write structural override updates across selected structures.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888888', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: '700' }}>Destination Column</label>
                <select value={bulkEditColumn} onChange={e => setBulkEditColumn(e.target.value)} style={{ backgroundColor: '#191919', border: '1px solid #2e2e2e', color: '#fff', fontSize: '13.5px', padding: '10px 14px', borderRadius: '6px', outline: 'none' }}>
                  <option value="">Choose Column...</option>
                  {(tableSchema.columns || []).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888888', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: '700' }}>Value Override Assignment</label>
                <input type="text" value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} placeholder="Overwrite string parameter" style={{ backgroundColor: '#191919', border: '1px solid #2e2e2e', color: '#fff', fontSize: '13.5px', padding: '10px 14px', borderRadius: '6px', outline: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setShowBulkEdit(false)} style={styles.btnSecondary}>Cancel</button>
              <button onClick={handleBulkEdit} style={styles.btnAccent}>Execute Writes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Insert Record Modal ──────────────────────────────────────────────── */}
      {showAddRow && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: '640px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>Insert Record: {selectedTable}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxHeight: '380px', overflowY: 'auto' }}>
              {addRowSchema.map(col => (
                <div key={col.name} style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11.5px', textTransform: 'uppercase', color: '#888888', marginBottom: '6px' }}>{col.name} <span style={{ color: '#555', fontSize: '9.5px' }}>({col.type})</span></label>
                  <input type="text" value={addRowValues[col.name] ?? ''} onChange={e => setAddRowValues({ ...addRowValues, [col.name]: e.target.value })} placeholder="NULL" style={{ backgroundColor: '#191919', border: '1px solid #2e2e2e', color: '#fff', fontSize: '13px', padding: '8px 12px', borderRadius: '6px', outline: 'none' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setShowAddRow(false)} style={styles.btnSecondary}>Cancel</button>
              <button onClick={handleAddRow} style={styles.btnAccent}>Persist Record</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Password Reset Modal ────────────────────────────────────────────── */}
      {pwModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff' }}>Bypass Profile Password Assignment</h3>
            <p style={{ color: '#888888', fontSize: '13.5px', lineHeight: '1.5', margin: '0 0 20px 0' }}>Commit high-level password hashes bypassing verification pipelines for <strong>{pwModal.name}</strong>.</p>
            {pwMsg && <div style={{ backgroundColor: 'rgba(52, 213, 154, 0.05)', border: '1px solid rgba(52, 213, 154, 0.2)', color: '#34D59A', fontSize: '13px', padding: '8px 12px', borderRadius: '6px', marginBottom: '16px' }}>{pwMsg}</div>}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888888', marginBottom: '6px', fontWeight: '700' }}>Fresh Core Password Override</label>
              <input type="text" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Minimum 6 characters" style={{ backgroundColor: '#191919', border: '1px solid #2e2e2e', color: '#fff', fontSize: '13.5px', padding: '10px 14px', borderRadius: '6px', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => { setPwModal(null); setPwMsg(''); }} style={styles.btnSecondary}>Cancel</button>
              <button onClick={handlePasswordChange} style={styles.btnAccent}>Commit Override</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Provision Administrator Modal ────────────────────────────────────── */}
      {showCreate && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#fff' }}>Provision Platform Administrator</h3>
            {createMsg && <div style={{ backgroundColor: 'rgba(52, 213, 154, 0.05)', border: '1px solid rgba(52, 213, 154, 0.2)', color: '#34D59A', fontSize: '13px', padding: '8px 12px', borderRadius: '6px', marginBottom: '16px' }}>{createMsg}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888888', marginBottom: '6px', fontWeight: '700' }}>Identity Full Name</label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} placeholder=" Alexis Smith" style={{ backgroundColor: '#191919', border: '1px solid #2e2e2e', color: '#fff', fontSize: '13.5px', padding: '10px 14px', borderRadius: '6px', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888888', marginBottom: '6px', fontWeight: '700' }}>Platform Email ID</label>
                <input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} placeholder="alexis@domain.com" style={{ backgroundColor: '#191919', border: '1px solid #2e2e2e', color: '#fff', fontSize: '13.5px', padding: '10px 14px', borderRadius: '6px', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888888', marginBottom: '6px', fontWeight: '700' }}>Platform Core Password</label>
                <input type="text" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Minimum 6 constraints" style={{ backgroundColor: '#191919', border: '1px solid #2e2e2e', color: '#fff', fontSize: '13.5px', padding: '10px 14px', borderRadius: '6px', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888888', marginBottom: '6px', fontWeight: '700' }}>Access Constraints Level</label>
                <select value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })} style={{ backgroundColor: '#191919', border: '1px solid #2e2e2e', color: '#fff', fontSize: '13.5px', padding: '10px 14px', borderRadius: '6px', outline: 'none' }}>
                  <option value="admin">Administrative Scope</option>
                  <option value="manager">Manager Operations Scope</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => { setShowCreate(false); setCreateMsg(''); }} style={styles.btnSecondary}>Cancel</button>
              <button onClick={handleCreateAdmin} style={styles.btnAccent}>Commit Record</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Purge User Confirmation Modal ────────────────────────────────────── */}
      {deleteConfirm && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, borderColor: 'rgba(239, 68, 68, 0.4)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#fca5a5' }}>Drop Identity Record</h3>
            <p style={{ color: '#888888', fontSize: '13.5px', lineHeight: '1.5', margin: '0 0 24px 0' }}>Are you absolutely sure you want to permanently delete <strong style={{ color: '#fff' }}>{deleteConfirm.name}</strong> from directory catalog databases?</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setDeleteConfirm(null)} style={styles.btnSecondary}>Abort</button>
              <button onClick={() => handleDeleteUser(deleteConfirm.id)} style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '8px 14px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }}>Execute Deletion</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}