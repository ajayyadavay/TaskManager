// TODO: Replace with your Firebase config

const firebaseConfig = {
  apiKey: "AIzaSyDEpgwb5n2hdSNiJDrjD6RWq1K2gyBCVjQ",
  authDomain: "civiltask-55d58.firebaseapp.com",
  projectId: "civiltask-55d58",
  storageBucket: "civiltask-55d58.firebasestorage.app",
  messagingSenderId: "797006430818",
  appId: "1:797006430818:web:c0cec896dc2259511c873b",
  measurementId: "G-4C7H3DZKQM"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentUser = null;
let currentGroup = null;
let currentGroupData = null;
let usersCache = [];
let currentUserData = null;
let tasksCache = [];
let issuesCache = [];
let categoriesCache = [];
let projectsCache = [];
let punchListsCache = [];
let notesCache = [];
let deadlineOperator = '=';

const FINISHED_TASK_STATUSES = new Set(['completed', 'closed', 'rejected']);

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkAuthState();
});

function setupEventListeners() {
  // Auth buttons
  document.getElementById('googleLoginBtn').addEventListener('click', handleGoogleLogin);
  document.getElementById('createNewGroupBtn').addEventListener('click', showCreateGroupPage);
  document.getElementById('createGroupBtn').addEventListener('click', handleCreateGroup);
  document.getElementById('backToLoginFromGroups').addEventListener('click', handleLogout);
  document.getElementById('backToGroupSelection').addEventListener('click', () => {
    // Reset cache and reload groups
    allUserGroupsCache = [];
    document.getElementById('groupSearch').value = '';
    loadUserGroups();
  });
  document.getElementById('logoutBtn').addEventListener('click', () => {
    allUserGroupsCache = [];
    handleLogout();
  });
  document.getElementById('changeGroupBtn').addEventListener('click', () => {
    allUserGroupsCache = [];
    loadUserGroups();
  });
  
  // Group search
  const groupSearchInput = document.getElementById('groupSearch');
  if (groupSearchInput) {
    groupSearchInput.addEventListener('input', (e) => {
      loadUserGroups(e.target.value);
    });
  }
  
  // Dashboard buttons
  document.getElementById('createTaskBtn').addEventListener('click', () => openTaskModal());
  document.getElementById('inviteUserBtn').addEventListener('click', openInviteUserModal);
  document.getElementById('createIssueBtn').addEventListener('click', openIssueModal);
  document.getElementById('createCategoryBtn')?.addEventListener('click', () => openCategoryModal());
  document.getElementById('createProjectBtn')?.addEventListener('click', () => openProjectModal());
  document.getElementById('createPunchListBtn')?.addEventListener('click', () => openPunchListModal());
  document.getElementById('addPunchListItemBtn')?.addEventListener('click', addPunchListItemToForm);
  document.getElementById('punchListCardViewBtn')?.addEventListener('click', () => {
    document.getElementById('punchListCardViewBtn').classList.add('active');
    document.getElementById('punchListListViewBtn').classList.remove('active');
    document.getElementById('punchListCardView').classList.remove('hidden');
    document.getElementById('punchListListView').classList.add('hidden');
  });
  document.getElementById('punchListListViewBtn')?.addEventListener('click', () => {
    document.getElementById('punchListCardViewBtn').classList.remove('active');
    document.getElementById('punchListListViewBtn').classList.add('active');
    document.getElementById('punchListCardView').classList.add('hidden');
    document.getElementById('punchListListView').classList.remove('hidden');
  });
  
  // Notes buttons
  document.getElementById('createNoteBtn')?.addEventListener('click', () => openNoteModal());
  document.getElementById('exportNoteToPdfBtn')?.addEventListener('click', exportNoteToPdf);
  
  // Editor toolbar
  document.querySelectorAll('.editor-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const command = btn.dataset.command;
      document.execCommand(command, false, null);
      document.getElementById('noteDescription').focus();
    });
  });
  
  document.getElementById('editorTextColor')?.addEventListener('input', (e) => {
    document.execCommand('foreColor', false, e.target.value);
    document.getElementById('noteDescription').focus();
  });
  
  document.getElementById('editorBgColor')?.addEventListener('input', (e) => {
    document.execCommand('hiliteColor', false, e.target.value);
    document.getElementById('noteDescription').focus();
  });
  
  document.getElementById('editorFontFamily')?.addEventListener('change', (e) => {
    document.execCommand('fontName', false, e.target.value);
    document.getElementById('noteDescription').focus();
  });
  
  document.getElementById('editorFontSize')?.addEventListener('change', (e) => {
    document.execCommand('fontSize', false, e.target.value);
    document.getElementById('noteDescription').focus();
  });
  
  // Nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const section = item.dataset.section;
      showSection(section);
      
      // If notifications section, load notifications
      if (section === 'notifications' && currentUser && currentGroup) {
        loadNotifications();
      }
      
      // If tasks section, update active filters UI
      if (section === 'tasks') {
        updateActiveFilters();
      }
      
      // If issues section, update active issue filters UI
      if (section === 'issues') {
        updateActiveIssueFilters();
      }

      if (section === 'deadlines') {
        loadDeadlineTasks();
      }
    });
  });

  // Task tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      loadTasks(e.target.dataset.tab);
    });
  });

  // Modals
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.modal').classList.add('hidden');
    });
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });

  // Forms
  document.getElementById('taskForm').addEventListener('submit', handleSaveTask);
  document.getElementById('inviteUserForm').addEventListener('submit', handleInviteUser);
  document.getElementById('issueForm').addEventListener('submit', handleSubmitIssue);
  document.getElementById('categoryForm')?.addEventListener('submit', handleSaveCategory);
  document.getElementById('projectForm')?.addEventListener('submit', handleSaveProject);
  document.getElementById('punchListForm')?.addEventListener('submit', handleSavePunchList);
  document.getElementById('noteForm')?.addEventListener('submit', handleSaveNote);
  document.getElementById('confirmTransferAdminBtn')?.addEventListener('click', confirmTransferAdmin);

  // User profile dropdown
  document.getElementById('userProfile').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('dropdownMenu').classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    document.getElementById('dropdownMenu').classList.add('hidden');
  });

  // Search and filter events
  ['taskSearch', 'taskStatusFilter', 'taskPrimaryFilter', 'taskSecondaryFilter', 'taskDateFilter', 'taskDeadlineFilter', 'taskRemainingDaysFilter', 'taskPriorityFilter', 'taskCategoryFilter', 'taskProjectFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        loadTasks(document.querySelector('.tab-btn.active')?.dataset.tab || 'all');
        updateActiveFilters();
      });
    }
  });

  ['issueSearch', 'issueStatusFilter', 'issueReportedByFilter', 'issueDateFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        loadIssues();
        updateActiveIssueFilters();
      });
    }
  });
  
  // Notes search and filter events
  ['noteSearch', 'noteVisibilityFilter', 'noteCreatedByFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', loadNotes);
      el.addEventListener('change', loadNotes);
    }
  });
  
  // Clear all issue filters button
  const clearAllIssueFiltersBtn = document.getElementById('clearAllIssueFiltersBtn');
  if (clearAllIssueFiltersBtn) {
    clearAllIssueFiltersBtn.addEventListener('click', () => {
      clearAllIssueFilters();
    });
  }
  
  // Clear all filters button
  const clearAllFiltersBtn = document.getElementById('clearAllFiltersBtn');
  if (clearAllFiltersBtn) {
    clearAllFiltersBtn.addEventListener('click', () => {
      clearAllTaskFilters();
    });
  }

  const deadlineDaysFilter = document.getElementById('deadlineDaysFilter');
  if (deadlineDaysFilter) {
    deadlineDaysFilter.addEventListener('input', () => {
      loadDeadlineTasks();
    });
  }

  //Run once for deadline operator buttons
   // existing listeners
  document.getElementById('deadlineDaysFilter')
    ?.addEventListener('input', loadDeadlineTasks);

  // deadline operator buttons
  document.querySelectorAll('.deadline-op-btn').forEach(btn => {
    btn.addEventListener('click', () => {

      document
        .querySelectorAll('.deadline-op-btn')
        .forEach(b => b.classList.remove('active'));

      btn.classList.add('active');

      deadlineOperator = btn.dataset.op;

      loadDeadlineTasks();
    });
  });
}

// Helper to clear all filters
function clearAllTaskFilters() {
  document.getElementById('taskSearch').value = '';
  document.getElementById('taskStatusFilter').value = '';
  document.getElementById('taskPrimaryFilter').value = '';
  document.getElementById('taskSecondaryFilter').value = '';
  document.getElementById('taskDateFilter').value = '';
  document.getElementById('taskDeadlineFilter').value = '';
  document.getElementById('taskRemainingDaysFilter').value = '';
  document.getElementById('taskPriorityFilter').value = '';
  document.getElementById('taskCategoryFilter').value = '';
  document.getElementById('taskProjectFilter').value = '';
  
  updateActiveFilters();
  loadTasks(document.querySelector('.tab-btn.active')?.dataset.tab || 'all');
}

// Function to update active filters UI
function updateActiveFilters() {
  const searchVal = document.getElementById('taskSearch').value.trim();
  const statusVal = document.getElementById('taskStatusFilter').value;
  const primaryVal = document.getElementById('taskPrimaryFilter').value;
  const secondaryVal = document.getElementById('taskSecondaryFilter').value;
  const dateVal = document.getElementById('taskDateFilter').value;
  const deadlineVal = document.getElementById('taskDeadlineFilter').value;
  const remainingDaysVal = document.getElementById('taskRemainingDaysFilter').value.trim();
  const priorityVal = document.getElementById('taskPriorityFilter')?.value;
  const categoryVal = document.getElementById('taskCategoryFilter')?.value;
  const projectVal = document.getElementById('taskProjectFilter')?.value;
  
  const activeFiltersList = document.getElementById('activeFiltersList');
  const filtersCountSpan = document.querySelector('.filters-count');
  
  let activeFilters = [];
  
  // Add search filter
  if (searchVal) {
    activeFilters.push({
      type: 'search',
      value: searchVal,
      label: searchVal,
      icon: '🔍'
    });
  }
  
  // Add status filter
  if (statusVal) {
    const statusLabels = {
      pending: 'Pending',
      accepted: 'Accepted',
      work_in_progress: 'Work In Progress',
      partially_completed: 'Partially Completed',
      completed: 'Completed',
      closed: 'Closed',
      rejected: 'Rejected'
    };
    
    activeFilters.push({
      type: 'status',
      value: statusVal,
      label: statusLabels[statusVal],
      icon: '🟡'
    });
  }
  
  // Add primary user filter
  if (primaryVal) {
    const user = usersCache.find(u => u.email === primaryVal);
    activeFilters.push({
      type: 'primary-user',
      value: primaryVal,
      label: user?.name || primaryVal,
      icon: '👤'
    });
  }
  
  // Add secondary user filter
  if (secondaryVal) {
    const user = usersCache.find(u => u.email === secondaryVal);
    activeFilters.push({
      type: 'secondary-user',
      value: secondaryVal,
      label: user?.name || secondaryVal,
      icon: '👥'
    });
  }
  
  // Add date filter
  if (dateVal) {
    activeFilters.push({
      type: 'date',
      value: dateVal,
      label: dateVal,
      icon: '📅'
    });
  }
  
  // Add deadline filter
  if (deadlineVal) {
    activeFilters.push({
      type: 'deadline',
      value: deadlineVal,
      label: deadlineVal,
      icon: '⏰'
    });
  }
  
  // Add remaining days filter
  if (remainingDaysVal) {
    activeFilters.push({
      type: 'remaining-days',
      value: remainingDaysVal,
      label: remainingDaysVal + ' days',
      icon: '📊'
    });
  }
  
  // Add priority filter
  if (priorityVal) {
    activeFilters.push({
      type: 'priority',
      value: priorityVal,
      label: 'Priority: ' + priorityVal,
      icon: priorityVal === 'High' ? '🔴' : priorityVal === 'Medium' ? '🟡' : '🟢'
    });
  }
  
  // Add category filter
  if (categoryVal) {
    const category = categoriesCache.find(c => c.id === categoryVal);
    activeFilters.push({
      type: 'category',
      value: categoryVal,
      label: 'Category: ' + (category?.name || categoryVal),
      icon: '📁'
    });
  }
  
  // Add project filter
  if (projectVal) {
    const project = projectsCache.find(p => p.id === projectVal);
    activeFilters.push({
      type: 'project',
      value: projectVal,
      label: 'Project: ' + (project?.name || projectVal),
      icon: '📋'
    });
  }
  
  // Update UI
  filtersCountSpan.textContent = `Filters (${activeFilters.length})`;
  
  if (activeFilters.length === 0) {
    activeFiltersList.innerHTML = `
      <div class="no-active-filters">No active filters</div>
    `;
  } else {
    activeFiltersList.innerHTML = activeFilters.map(filter => {
      let chipClass = 'filter-chip ';
      
      switch (filter.type) {
        case 'search':
          chipClass += 'filter-chip-search';
          break;
        case 'status':
          chipClass += `filter-chip-status-${filter.value}`;
          break;
        case 'primary-user':
          chipClass += 'filter-chip-primary-user';
          break;
        case 'secondary-user':
          chipClass += 'filter-chip-secondary-user';
          break;
        case 'date':
          chipClass += 'filter-chip-date';
          break;
        case 'deadline':
          chipClass += 'filter-chip-date';
          break;
        case 'remaining-days':
          chipClass += 'filter-chip-search';
          break;
      }
      
      return `
        <div class="${chipClass}" data-type="${filter.type}" data-value="${filter.value}">
          <span class="filter-chip-icon">${filter.icon}</span>
          <span class="filter-chip-label">${filter.label}</span>
          <button class="filter-chip-remove" aria-label="Remove ${filter.label} filter" onclick="removeActiveFilter('${filter.type}', '${filter.value}')">×</button>
        </div>
      `;
    }).join('');
  }
}

// Function to remove single filter
window.removeActiveFilter = function(type, value) {
  switch (type) {
    case 'search':
      document.getElementById('taskSearch').value = '';
      break;
    case 'status':
      document.getElementById('taskStatusFilter').value = '';
      break;
    case 'primary-user':
      document.getElementById('taskPrimaryFilter').value = '';
      break;
    case 'secondary-user':
      document.getElementById('taskSecondaryFilter').value = '';
      break;
    case 'date':
      document.getElementById('taskDateFilter').value = '';
      break;
    case 'deadline':
      document.getElementById('taskDeadlineFilter').value = '';
      break;
    case 'remaining-days':
      document.getElementById('taskRemainingDaysFilter').value = '';
      break;
    case 'priority':
      document.getElementById('taskPriorityFilter').value = '';
      break;
    case 'category':
      document.getElementById('taskCategoryFilter').value = '';
      break;
    case 'project':
      document.getElementById('taskProjectFilter').value = '';
      break;
  }
  
  updateActiveFilters();
  loadTasks(document.querySelector('.tab-btn.active')?.dataset.tab || 'all');
}

// Function to clear all issue filters
function clearAllIssueFilters() {
  document.getElementById('issueSearch').value = '';
  document.getElementById('issueStatusFilter').value = '';
  document.getElementById('issueReportedByFilter').value = '';
  document.getElementById('issueDateFilter').value = '';
  
  updateActiveIssueFilters();
  loadIssues();
}

// Function to update active issue filters UI
function updateActiveIssueFilters() {
  const searchVal = document.getElementById('issueSearch').value.trim();
  const statusVal = document.getElementById('issueStatusFilter').value;
  const reportedByVal = document.getElementById('issueReportedByFilter').value;
  const dateVal = document.getElementById('issueDateFilter').value;
  
  const activeFiltersList = document.getElementById('activeIssueFiltersList');
  const filtersCountSpan = document.getElementById('issueFiltersCount');
  
  let activeFilters = [];
  
  // Add search filter
  if (searchVal) {
    activeFilters.push({
      type: 'search',
      value: searchVal,
      label: searchVal,
      icon: '🔍'
    });
  }
  
  // Add status filter
  if (statusVal) {
    const statusLabels = {
      open: 'Open',
      converted: 'Converted to Task'
    };
    
    activeFilters.push({
      type: 'status',
      value: statusVal,
      label: statusLabels[statusVal],
      icon: '🟡'
    });
  }
  
  // Add reported by filter
  if (reportedByVal) {
    const user = usersCache.find(u => u.email === reportedByVal);
    activeFilters.push({
      type: 'reported-by',
      value: reportedByVal,
      label: user?.name || reportedByVal,
      icon: '👤'
    });
  }
  
  // Add date filter
  if (dateVal) {
    activeFilters.push({
      type: 'date',
      value: dateVal,
      label: dateVal,
      icon: '📅'
    });
  }
  
  // Update UI
  filtersCountSpan.textContent = `Filters (${activeFilters.length})`;
  
  if (activeFilters.length === 0) {
    activeFiltersList.innerHTML = `
      <div class="no-active-filters">No active filters</div>
    `;
  } else {
    activeFiltersList.innerHTML = activeFilters.map(filter => {
      let chipClass = 'filter-chip ';
      
      switch (filter.type) {
        case 'search':
          chipClass += 'filter-chip-search';
          break;
        case 'status':
          chipClass += `filter-chip-status-${filter.value}`;
          break;
        case 'reported-by':
          chipClass += 'filter-chip-reported-by-user';
          break;
        case 'date':
          chipClass += 'filter-chip-issue-date';
          break;
      }
      
      return `
        <div class="${chipClass}" data-type="${filter.type}" data-value="${filter.value}">
          <span class="filter-chip-icon">${filter.icon}</span>
          <span class="filter-chip-label">${filter.label}</span>
          <button class="filter-chip-remove" aria-label="Remove ${filter.label} filter" onclick="removeActiveIssueFilter('${filter.type}', '${filter.value}')">×</button>
        </div>
      `;
    }).join('');
  }
}

// Function to remove single issue filter
window.removeActiveIssueFilter = function(type, value) {
  switch (type) {
    case 'search':
      document.getElementById('issueSearch').value = '';
      break;
    case 'status':
      document.getElementById('issueStatusFilter').value = '';
      break;
    case 'reported-by':
      document.getElementById('issueReportedByFilter').value = '';
      break;
    case 'date':
      document.getElementById('issueDateFilter').value = '';
      break;
  }
  
  updateActiveIssueFilters();
  loadIssues();
}



async function loadNotifications() {
  if (!currentUser || !currentGroup) return;
  
  const snapshot = await db.collection('groups').doc(currentGroup)
    .collection('users').doc(currentUser.email)
    .collection('notifications')
    .orderBy('createdAt', 'desc')
    .get();
    
  const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderNotifications(notifications);
}

async function getUsersForNotifications() {
  if (usersCache.length > 0) {
    return usersCache;
  }

  const snapshot = await db.collection('groups').doc(currentGroup).collection('users').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function notifyAdmins(notification) {
  const users = await getUsersForNotifications();
  const admins = users.filter(user => user.isAdmin && user.email !== currentUser.email);

  await Promise.all(admins.map(admin => (
    db.collection('groups').doc(currentGroup)
      .collection('users').doc(admin.email)
      .collection('notifications').add({
        ...notification,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      })
  )));
}

function checkAuthState() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      const storedGroup = localStorage.getItem('currentGroup');
      if (storedGroup) {
        try {
          await loadGroup(storedGroup);
        } catch {
          await loadUserGroups();
        }
      } else {
        await loadUserGroups();
      }
    } else {
      showLogin();
    }
  });
}

async function handleGoogleLogin() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account' // Always show account picker
    });
    const result = await auth.signInWithPopup(provider);
    currentUser = result.user;
    await loadUserGroups();
  } catch (error) {
    console.error('Login error:', error);
    alert('Login failed: ' + error.message);
  }
}

let allUserGroupsCache = [];

async function loadUserGroups(searchTerm = '') {
  try {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('createGroupPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('groupSelectionPage').classList.remove('hidden');

    const groupsList = document.getElementById('groupsList');
    groupsList.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 2rem;">Loading groups...</p>';

    const normalizeGroupId = (value) => String(value || '').trim().toLowerCase();

    // First, check if we need to load groups
    if (allUserGroupsCache.length === 0) {
      // Get all groups and check if user is a member
      const allGroupsSnapshot = await db.collection('groups').get();
      
      allUserGroupsCache = [];
      const seenGroupIds = new Set();
      
      for (const groupDoc of allGroupsSnapshot.docs) {
        const groupId = normalizeGroupId(groupDoc.id);

        // Skip duplicate group IDs
        if (!groupId || seenGroupIds.has(groupId)) continue;
        
        // Check if current user is a member of this group
        const userDoc = await groupDoc.ref.collection('users').doc(currentUser.email).get();
        
        if (userDoc.exists) {
          seenGroupIds.add(groupId);
          allUserGroupsCache.push({
            ...groupDoc.data(),
            id: groupId,
            groupId,
            role: userDoc.data().isAdmin ? 'Admin' : 'Member',
            isAdmin: userDoc.data().isAdmin
          });
        }
      }
    }

    // Apply search filter
    let userGroups = allUserGroupsCache.filter((group, index, groups) => {
      const groupId = normalizeGroupId(group.groupId || group.id);
      return groupId && index === groups.findIndex(item => normalizeGroupId(item.groupId || item.id) === groupId);
    });

    if (searchTerm.trim()) {
      userGroups = userGroups.filter(group => 
        normalizeGroupId(group.groupId || group.id).includes(searchTerm.toLowerCase())
      );
    }

    if (userGroups.length > 0) {
      groupsList.innerHTML = userGroups.map(group => `
        <div class="group-card" style="position: relative;">
          <div onclick="loadGroup('${group.groupId || group.id}')" style="cursor: pointer;">
            <h4>${group.groupId || group.id}</h4>
            <p>Your role: <span class="role-badge">${group.role}</span></p>
          </div>
          ${group.isAdmin ? `<button class="btn secondary-btn small-btn" onclick="event.stopPropagation(); deleteGroup('${group.groupId || group.id}')" style="position: absolute; top: 1rem; right: 1rem; padding: 0.4rem 0.8rem; background: var(--danger-100); color: var(--danger-600); border: none;">Delete</button>` : ''}
        </div>
      `).join('');
    } else {
      groupsList.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 2rem;">No groups found. Create a new one to get started!</p>';
    }

  } catch (error) {
    console.error('Load user groups error:', error);
    const groupsList = document.getElementById('groupsList');
    groupsList.innerHTML = '<p style="color: var(--danger-600); text-align: center; padding: 2rem;">Error loading groups: ' + error.message + '</p>';
  }
}

async function deleteGroup(groupId) {
  if (!confirm(`Are you sure you want to delete the group "${groupId}"? This cannot be undone!`)) {
    return;
  }

  try {
    // Delete all subcollections first (users, tasks, issues)
    const groupRef = db.collection('groups').doc(groupId);
    
    // Delete users subcollection
    const usersSnapshot = await groupRef.collection('users').get();
    const userDeletes = usersSnapshot.docs.map(doc => doc.ref.delete());
    
    // Delete tasks subcollection
    const tasksSnapshot = await groupRef.collection('tasks').get();
    const taskDeletes = tasksSnapshot.docs.map(doc => doc.ref.delete());
    
    // Delete issues subcollection
    const issuesSnapshot = await groupRef.collection('issues').get();
    const issueDeletes = issuesSnapshot.docs.map(doc => doc.ref.delete());
    
    // Wait for all deletes
    await Promise.all([...userDeletes, ...taskDeletes, ...issueDeletes]);
    
    // Delete the group document itself
    await groupRef.delete();
    
    // Remove from cache and reload
    allUserGroupsCache = [];
    alert('Group deleted successfully!');
    loadUserGroups();
  } catch (error) {
    console.error('Delete group error:', error);
    alert('Failed to delete group: ' + error.message);
  }
}

function showCreateGroupPage() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('groupSelectionPage').classList.add('hidden');
  document.getElementById('dashboardPage').classList.add('hidden');
  document.getElementById('createGroupPage').classList.remove('hidden');
}

async function handleCreateGroup() {
  const groupName = document.getElementById('newGroupName').value.trim().toLowerCase();
  const adminName = document.getElementById('adminName').value.trim();
  const adminPosition = document.getElementById('adminPosition').value.trim();

  if (!groupName || !adminName || !adminPosition) {
    alert('Please fill all fields');
    return;
  }

  try {
    const groupRef = db.collection('groups').doc(groupName);
    await groupRef.set({
      name: groupName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      adminEmail: currentUser.email
    });

    await groupRef.collection('users').doc(currentUser.email).set({
      email: currentUser.email,
      name: adminName,
      position: adminPosition,
      isAdmin: true,
      invitedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await loadGroup(groupName);
  } catch (error) {
    console.error('Create group error:', error);
    alert('Failed to create group: ' + error.message);
  }
}

async function loadGroup(groupName) {
  try {
    currentGroup = groupName.toLowerCase();
    localStorage.setItem('currentGroup', currentGroup);

    const groupRef = db.collection('groups').doc(currentGroup);
    const groupDoc = await groupRef.get();
    
    if (!groupDoc.exists) {
      alert('Group not found');
      await loadUserGroups();
      return;
    }

    currentGroupData = groupDoc.data();

    const userRef = groupRef.collection('users').doc(currentUser.email);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      alert('You are not a member of this group');
      await loadUserGroups();
      return;
    }

    currentUserData = userDoc.data();
    
    // Update UI
    document.getElementById('navGroupName').textContent = currentGroup;
    document.getElementById('navUserName').textContent = currentUserData.name;
    document.getElementById('navUserEmail').textContent = currentUser.email;

    // Set user avatar
    const avatarEl = document.getElementById('userAvatar');
    if (currentUser.photoURL) {
      avatarEl.innerHTML = `<img src="${currentUser.photoURL}" alt="Avatar">`;
    } else {
      avatarEl.textContent = currentUserData.name.charAt(0).toUpperCase();
    }

    // Show/hide admin UI
    if (currentUserData.isAdmin) {
      document.getElementById('createTaskBtn').classList.remove('hidden');
      document.getElementById('inviteUserBtn').classList.remove('hidden');
      document.getElementById('adminNavUsers').classList.remove('hidden');
      document.getElementById('adminNavProject').classList.remove('hidden');
    } else {
      document.getElementById('createTaskBtn').classList.add('hidden');
      document.getElementById('inviteUserBtn').classList.add('hidden');
      document.getElementById('adminNavUsers').classList.add('hidden');
      document.getElementById('adminNavProject').classList.add('hidden');
    }

    await loadUsers();
    populateUserFilters();
    showDashboardPage();
    
    // Set up realtime listeners
    setupRealtimeListeners();

  } catch (error) {
    console.error('Load group error:', error);
    alert('Failed to load group: ' + error.message);
  }
}

let unsubscribeNotifications = null;

function setupRealtimeListeners() {
  // Listen for task changes
  db.collection('groups').doc(currentGroup).collection('tasks')
    .orderBy('assignedAt', 'desc')
    .onSnapshot(snapshot => {
      tasksCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      loadTasks(document.querySelector('.tab-btn.active')?.dataset.tab || 'all');
      renderDashboardStats();
      if (!document.getElementById('deadlinesSection').classList.contains('hidden')) {
        loadDeadlineTasks();
      }
    });

  // Listen for issue changes
  db.collection('groups').doc(currentGroup).collection('issues')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      issuesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      loadIssues();
      renderDashboardStats();
    });

  // Listen for user changes
  db.collection('groups').doc(currentGroup).collection('users')
    .onSnapshot(snapshot => {
      usersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      populateUserFilters();
      loadUsersList();
      // Update active filters if on tasks section
      if (!document.getElementById('tasksSection').classList.contains('hidden')) {
        updateActiveFilters();
      }
      // Update active issue filters if on issues section
      if (!document.getElementById('issuesSection').classList.contains('hidden')) {
        updateActiveIssueFilters();
      }
      if (!document.getElementById('deadlinesSection').classList.contains('hidden')) {
        loadDeadlineTasks();
      }
    });

  // Listen for categories changes
  db.collection('groups').doc(currentGroup).collection('categories')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      categoriesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      populateCategoryProjectFilters();
      renderCategoriesList();
      updateCounts();
    });

  // Listen for projects changes
  db.collection('groups').doc(currentGroup).collection('projects')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      projectsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      populateCategoryProjectFilters();
      renderProjectsList();
      updateCounts();
    });

  // Listen for punch lists changes
  db.collection('groups').doc(currentGroup).collection('punchLists')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      punchListsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderPunchLists();
    });
  
  // Listen for notes changes
  db.collection('groups').doc(currentGroup).collection('notes')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      notesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      loadNotes();
      populateNoteCreatedByFilter();
    });
  
  // Listen for notifications for the current user
  if (unsubscribeNotifications) unsubscribeNotifications();
  unsubscribeNotifications = db.collection('groups').doc(currentGroup)
    .collection('users').doc(currentUser.email)
    .collection('notifications')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateNotificationBadge(notifications);
      if (!document.getElementById('notificationsSection').classList.contains('hidden')) {
        renderNotifications(notifications);
      }
    });
}

function updateNotificationBadge(notifications) {
  const unreadCount = notifications.filter(n => !n.read).length;
  const badge = document.getElementById('notificationBadge');
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderNotifications(notifications) {
  const list = document.getElementById('notificationsList');
  
  if (notifications.length === 0) {
    list.innerHTML = `
      <div class="empty-notifications">
        <p>No notifications yet.</p>
      </div>
    `;
    return;
  }
  
  list.innerHTML = notifications.map(notification => {
    let dateStr = '';
    if (notification.createdAt) {
      let date = notification.createdAt.toDate ? notification.createdAt.toDate() : new Date(notification.createdAt);
      dateStr = date.toLocaleString();
    }
    
    return `
      <div class="notification-card ${notification.read ? '' : 'unread'}" 
           data-notification-id="${notification.id}"
           data-task-id="${notification.taskId || ''}"
           onclick="handleNotificationClick('${notification.id}', '${notification.taskId || ''}')">
        <div class="notification-message">${notification.message}</div>
        <div class="notification-date">${dateStr}</div>
      </div>
    `;
  }).join('');
}

async function handleNotificationClick(notificationId, taskId) {
  // Mark as read
  if (notificationId) {
    await db.collection('groups').doc(currentGroup)
      .collection('users').doc(currentUser.email)
      .collection('notifications').doc(notificationId)
      .update({ read: true });
  }
  
  // Navigate to tasks section if taskId is present
  if (taskId) {
    // Set active nav item
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector('.nav-item[data-section="tasks"]').classList.add('active');
    showSection('tasks');
    
    // Slight delay then open view task modal
    setTimeout(() => {
      openViewTaskModal(taskId);
    }, 100);
  }
}

async function clearAllNotifications() {
  if (!confirm('Are you sure you want to clear all notifications?')) return;
  
  const snapshot = await db.collection('groups').doc(currentGroup)
    .collection('users').doc(currentUser.email)
    .collection('notifications').get();
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  
  alert('All notifications cleared!');
}

// Also update progress update functions to send notifications
window.updateProgress = async function(taskId) {
  const desc = document.getElementById('progressDesc').value.trim();
  const status = document.getElementById('progressStatus').value;
  
  if (!desc) {
    alert('Please enter a progress description');
    return;
  }
  
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  
  const task = tasksCache.find(t => t.id === taskId);
  const taskDisplayId = task?.taskId || taskId;
  
  await db.collection('groups').doc(currentGroup).collection('tasks').doc(taskId).update({
    status: status,
    progress: firebase.firestore.FieldValue.arrayUnion({
      user: currentUser.email,
      date,
      time,
      description: desc,
      status,
      verifiedByPrimary: false
    }),
    trail: firebase.firestore.FieldValue.arrayUnion({
      action: 'Progress Updated',
      user: currentUser.email,
      date,
      time,
      details: `Status updated to ${status.replace('_', ' ')}`
    })
  });
  
  // Send notification to primary user if we're secondary
  if (task && task.primaryUser && task.primaryUser !== currentUser.email) {
    await db.collection('groups').doc(currentGroup)
      .collection('users').doc(task.primaryUser)
      .collection('notifications').add({
        type: 'task_updated',
        taskId,
        taskDisplayId,
        message: `Task ${taskDisplayId} has been updated by ${usersCache.find(u => u.email === currentUser.email)?.name || currentUser.email}`,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  }
  
  document.getElementById('viewTaskModal').classList.add('hidden');
}

// Also update verify progress to send notification
window.verifyProgress = async function(taskId) {
  const task = tasksCache.find(t => t.id === taskId);
  const note = document.getElementById('primaryNote')?.value.trim();
  
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  
  const progressUpdates = [...task.progress];
  // Mark last progress as verified
  progressUpdates[progressUpdates.length - 1].verifiedByPrimary = true;
  
  const updates = {
    progress: progressUpdates,
    trail: firebase.firestore.FieldValue.arrayUnion({
      action: 'Progress Verified',
      user: currentUser.email,
      date,
      time,
      details: 'Primary user verified progress'
    })
  };
  
  // If note exists, add new progress item for verification
  if (note) {
    updates.progress = firebase.firestore.FieldValue.arrayUnion({
      user: currentUser.email,
      date,
      time,
      description: note,
      status: 'verified',
      type: 'verification_note',
      verifiedByPrimary: true
    });
  }
  
  await db.collection('groups').doc(currentGroup).collection('tasks').doc(taskId).update(updates);
  
  // Send notification to admin or secondary user
  const taskDisplayId = task?.taskId || taskId;
  if (task && task.secondaryUser && task.secondaryUser !== currentUser.email) {
    await db.collection('groups').doc(currentGroup)
      .collection('users').doc(task.secondaryUser)
      .collection('notifications').add({
        type: 'progress_verified',
        taskId,
        taskDisplayId,
        message: `Your progress update on task ${taskDisplayId} has been verified`,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  }

  await notifyAdmins({
    type: 'progress_verified_admin',
    taskId,
    taskDisplayId,
    message: `Progress for task ${taskDisplayId} was verified by ${usersCache.find(u => u.email === currentUser.email)?.name || currentUser.email}`
  });
  
  document.getElementById('viewTaskModal').classList.add('hidden');
}

function isTaskFinished(task) {
  return FINISHED_TASK_STATUSES.has(task.status);
}

function getVisibleTasksForCurrentUser(tasks = tasksCache) {
  if (currentUserData?.isAdmin) {
    return [...tasks];
  }

  return tasks.filter(task =>
    task.primaryUser === currentUser.email ||
    (task.secondaryUser === currentUser.email && task.status !== 'pending')
  );
}

function getLatestProgress(task) {
  if (!task.progress || task.progress.length === 0) {
    return null;
  }

  return task.progress[task.progress.length - 1];
}

function getDashboardTaskStatus(task) {
  const latestProgress = getLatestProgress(task);

  if (
    ['work_in_progress', 'partially_completed', 'completed'].includes(task.status) &&
    latestProgress &&
    latestProgress.verifiedByPrimary !== true
  ) {
    return 'accepted';
  }

  return task.status;
}

function getDateOnly(dateValue) {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getTaskDeadlineOffset(task) {
  const today = getDateOnly(new Date());
  const deadline = getDateOnly(task.deadline);
  return Math.round((deadline - today) / (1000 * 60 * 60 * 24));
}

function bindTaskCardActions(container = document) {
  container.querySelectorAll('.view-task-btn').forEach(btn => {
    btn.addEventListener('click', () => openViewTaskModal(btn.dataset.id));
  });

  container.querySelectorAll('.accept-task-btn').forEach(btn => {
    btn.addEventListener('click', () => acceptTask(btn.dataset.id));
  });

  container.querySelectorAll('.reject-task-btn').forEach(btn => {
    btn.addEventListener('click', () => rejectTask(btn.dataset.id));
  });
}

async function loadUsers() {
  const snapshot = await db.collection('groups').doc(currentGroup).collection('users').get();
  usersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function populateUserFilters() {
  // Populate task form selects
  const primarySelect = document.getElementById('taskPrimary');
  const secondarySelect = document.getElementById('taskSecondary');
  const primaryFilter = document.getElementById('taskPrimaryFilter');
  const secondaryFilter = document.getElementById('taskSecondaryFilter');
  const reportedByFilter = document.getElementById('issueReportedByFilter');
  
  primarySelect.innerHTML = '<option value="">Select Primary User</option>' +
    usersCache.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('');
  secondarySelect.innerHTML = '<option value="">Select Secondary User (Optional)</option>' +
    usersCache.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('');
  primaryFilter.innerHTML = '<option value="">All Primary Users</option>' +
    usersCache.map(u => `<option value="${u.email}">${u.name}</option>`).join('');
  secondaryFilter.innerHTML = '<option value="">All Secondary Users</option>' +
    usersCache.map(u => `<option value="${u.email}">${u.name}</option>`).join('');
  reportedByFilter.innerHTML = '<option value="">All Reporters</option>' +
    usersCache.map(u => `<option value="${u.email}">${u.name}</option>`).join('');
  
  // Populate category and project filters/selects
  populateCategoryProjectFilters();
}

function showLogin() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('createGroupPage').classList.add('hidden');
  document.getElementById('groupSelectionPage').classList.add('hidden');
  document.getElementById('dashboardPage').classList.add('hidden');
}

function showDashboardPage() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('createGroupPage').classList.add('hidden');
  document.getElementById('groupSelectionPage').classList.add('hidden');
  document.getElementById('dashboardPage').classList.remove('hidden');
  
  // Reset nav to dashboard
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector('.nav-item[data-section="dashboard"]').classList.add('active');
  showSection('dashboard');
}

function showSection(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById(section + 'Section').classList.remove('hidden');
}

async function handleLogout() {
  try {
    await auth.signOut();
  } catch (error) {
    console.error('Logout error:', error);
  }
  localStorage.removeItem('currentGroup');
  allUserGroupsCache = []; // Clear group cache on logout
  currentUser = null;
  currentGroup = null;
  currentGroupData = null;
  usersCache = [];
  currentUserData = null;
  tasksCache = [];
  issuesCache = [];
  categoriesCache = [];
  projectsCache = [];
  punchListsCache = [];
  notesCache = [];
  showLogin();
}

function renderDashboardStats() {
  // Task stats
  let taskStats = {
    total: 0,
    pending: 0,
    accepted: 0,
    wip: 0,
    partiallyCompleted: 0,
    completed: 0,
    closed: 0,
    rejected: 0
  };
  
  getVisibleTasksForCurrentUser(tasksCache).forEach(task => {
    const dashboardStatus = getDashboardTaskStatus(task);
    taskStats.total++;
    if (dashboardStatus === 'pending') taskStats.pending++;
    if (dashboardStatus === 'accepted') taskStats.accepted++;
    if (dashboardStatus === 'work_in_progress') taskStats.wip++;
    if (dashboardStatus === 'partially_completed') taskStats.partiallyCompleted++;
    if (dashboardStatus === 'completed') taskStats.completed++;
    if (dashboardStatus === 'closed') taskStats.closed++;
    if (dashboardStatus === 'rejected') taskStats.rejected++;
    /*if (dashboardStatus === 'work_in_progress' || dashboardStatus === 'partially_completed') taskStats.wip++;
    if (dashboardStatus === 'completed' || dashboardStatus === 'closed') taskStats.completed++;*/
  });
  
  //Do nut shaped chart for closed tasks chart
const closedPercentage =
  taskStats.total > 0
    ? Math.round((taskStats.closed / taskStats.total) * 100)
    : 0;

    let donutColor;

if (closedPercentage < 25) {
  donutColor = '#ef4444'; // red
} else if (closedPercentage < 50) {
  donutColor = '#f97316'; // orange
} else if (closedPercentage < 75) {
  donutColor = '#eab308'; // yellow
} else if (closedPercentage < 100) {
  donutColor = '#22c55e'; // green
} else {
  donutColor = '#16a34a'; // dark green
}


const radius = 85;
const circumference = 2 * Math.PI * radius;

const circle = document.getElementById('closedDonutCircle');

if (circle) {
  circle.style.strokeDasharray = circumference;

  circle.style.strokeDashoffset =
    circumference -
    (closedPercentage / 100) * circumference;
}

document.getElementById('closedPercent').textContent =
  `${closedPercentage}%`;

document.getElementById('closedRatio').textContent =
  `${taskStats.closed} of ${taskStats.total} Tasks`;

  // CHANGE CENTER TEXT COLORS
  circle.style.stroke = donutColor;
document.getElementById('closedPercent').style.color = donutColor;

const donutLabel = document.querySelector('.donut-label');
if (donutLabel) {
  donutLabel.style.color = donutColor;
}

// OPTIONAL: COLOR GLOW EFFECT
const chartPanel = document.querySelector('.dashboard-chart-panel');
if (chartPanel) {
  chartPanel.style.boxShadow =
    `0 15px 40px ${donutColor}22`;
}

  // Issue stats
  const isAdmin = currentUserData?.isAdmin;
  let issueStats = {
    total: 0,
    converted: 0,
    remaining: 0
  };
  
  issuesCache.forEach(issue => {
    if (!isAdmin && issue.reportedBy !== currentUser.email) {
      return;
    }
    issueStats.total++;
    if (issue.status === 'converted') issueStats.converted++;
    if (issue.status === 'open') issueStats.remaining++;
  });
  
  // Render task metrics
  
  
  //Render task metrics with separate partially completed and closed tasks
document.getElementById('tasksMetricsGrid').innerHTML = `
<div class="metric-card metric-total">
  <div class="metric-icon"><i class="fas fa-clipboard-list"></i></div>
  <div class="metric-number">${taskStats.total}</div>
  <div class="metric-label">Total Tasks</div>
</div>

<div class="metric-card metric-pending">
  <div class="metric-icon"><i class="fas fa-clock"></i></div>
  <div class="metric-number">${taskStats.pending}</div>
  <div class="metric-label">Pending Tasks</div>
</div>

<div class="metric-card metric-accepted">
  <div class="metric-icon"><i class="fas fa-check"></i></div>
  <div class="metric-number">${taskStats.accepted}</div>
  <div class="metric-label">Accepted Tasks</div>
</div>

<div class="metric-card metric-wip">
  <div class="metric-icon"><i class="fas fa-sync-alt"></i></div>
  <div class="metric-number">${taskStats.wip}</div>
  <div class="metric-label">Work in Progress</div>
</div>

<div class="metric-card metric-partial">
  <div class="metric-icon"><i class="fas fa-chart-pie"></i></div>
  <div class="metric-number">${taskStats.partiallyCompleted}</div>
  <div class="metric-label">Partially Completed</div>
</div>

<div class="metric-card metric-rejected">
  <div class="metric-icon"><i class="fas fa-ban"></i></div>
  <div class="metric-number">${taskStats.rejected}</div>
  <div class="metric-label">Rejected Tasks</div>
</div>

<div class="metric-card metric-completed">
  <div class="metric-icon"><i class="fas fa-flag"></i></div>
  <div class="metric-number">${taskStats.completed}</div>
  <div class="metric-label">Completed Tasks</div>
</div>

<div class="metric-card metric-closed">
  <div class="metric-icon"><i class="fas fa-lock"></i></div>
  <div class="metric-number">${taskStats.closed}</div>
  <div class="metric-label">Closed Tasks</div>
</div>
`;

  // Render issue metrics
  document.getElementById('issuesMetricsGrid').innerHTML = `
<div class="metric-card issue-total">
  <div class="metric-icon"><i class="fas fa-file-alt"></i></div>
  <div class="metric-number">${issueStats.total}</div>
  <div class="metric-label">Total Issues</div>
</div>

<div class="metric-card issue-converted">
  <div class="metric-icon"><i class="fas fa-check"></i></div>
  <div class="metric-number">${issueStats.converted}</div>
  <div class="metric-label">Converted to Tasks</div>
</div>

<div class="metric-card issue-remaining">
  <div class="metric-icon"><i class="fas fa-exclamation"></i></div>
  <div class="metric-number">${issueStats.remaining}</div>
  <div class="metric-label">Remaining Issues</div>
</div>
`;
}

function loadTasks(tab) {
  let tasks = getVisibleTasksForCurrentUser(tasksCache);
  
  // Apply tab filter
  if (tab === 'primary') {
    tasks = tasks.filter(t => t.primaryUser === currentUser.email);
  } else if (tab === 'secondary') {
    tasks = tasks.filter(t => t.secondaryUser === currentUser.email && t.status !== 'pending');
  }

  // Apply search and filter
  const searchTerm = document.getElementById('taskSearch').value.toLowerCase();
  const statusFilter = document.getElementById('taskStatusFilter').value;
  const primaryFilter = document.getElementById('taskPrimaryFilter').value;
  const secondaryFilter = document.getElementById('taskSecondaryFilter').value;
  const dateFilter = document.getElementById('taskDateFilter').value;
  const deadlineFilter = document.getElementById('taskDeadlineFilter').value;
  const remainingDaysFilter = document.getElementById('taskRemainingDaysFilter').value.trim();
  const priorityFilter = document.getElementById('taskPriorityFilter')?.value;
  const categoryFilter = document.getElementById('taskCategoryFilter')?.value;
  const projectFilter = document.getElementById('taskProjectFilter')?.value;

  if (searchTerm) {
    tasks = tasks.filter(t => 
      t.taskId.toLowerCase().includes(searchTerm) || 
      t.description.toLowerCase().includes(searchTerm)
    );
  }

  if (statusFilter) {
    tasks = tasks.filter(t => t.status === statusFilter);
  }

  if (primaryFilter) {
    tasks = tasks.filter(t => t.primaryUser === primaryFilter);
  }

  if (secondaryFilter) {
    tasks = tasks.filter(t => t.secondaryUser === secondaryFilter);
  }

  if (dateFilter) {
    tasks = tasks.filter(t => t.assignedDate === dateFilter);
  }
  
  if (deadlineFilter) {
    tasks = tasks.filter(t => t.deadline === deadlineFilter);
  }
  
  if (remainingDaysFilter) {
    const remainingDays = parseInt(remainingDaysFilter, 10);
    if (!isNaN(remainingDays)) {
      tasks = tasks.filter(t => {
        const remaining = getTaskDeadlineOffset(t);
        return remaining === remainingDays;
      });
    }
  }
  
  if (priorityFilter) {
    tasks = tasks.filter(t => t.priority === priorityFilter);
  }
  
  if (categoryFilter) {
    tasks = tasks.filter(t => t.categoryId === categoryFilter);
  }
  
  if (projectFilter) {
    tasks = tasks.filter(t => t.projectId === projectFilter);
  }

  document.getElementById('tasksList').innerHTML = tasks.map(task => renderTaskCard(task)).join('');
  bindTaskCardActions(document.getElementById('tasksList'));
}

function loadDeadlineTasks() {
  const deadlineDaysFilter = document.getElementById('deadlineDaysFilter');
  const deadlineSummary = document.getElementById('deadlineSummary');
  const deadlinesList = document.getElementById('deadlinesList');

  if (!deadlineDaysFilter || !deadlineSummary || !deadlinesList) {
    return;
  }

  let daysValue = parseInt(deadlineDaysFilter.value, 10);

  if (Number.isNaN(daysValue)) {
    daysValue = 0;
  }

  deadlineDaysFilter.value = String(daysValue);

  const filteredTasks = getVisibleTasksForCurrentUser(tasksCache)
    .filter(task => {
      const deadlineOffset = getTaskDeadlineOffset(task);

      //return deadlineOffset === daysValue && !isTaskFinished(task);
      if (isTaskFinished(task)) {
  return false;
}

switch (deadlineOperator) {

  case '=':
    return deadlineOffset === daysValue;

  case '<':
    return deadlineOffset < daysValue;

  case '<=':
    return deadlineOffset <= daysValue;

  case '>':
    return deadlineOffset > daysValue;

  case '>=':
    return deadlineOffset >= daysValue;

  default:
    return deadlineOffset === daysValue;
}
    })
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  /*if (daysValue < 0) {
    deadlineSummary.textContent =
      `Showing tasks overdue by ${Math.abs(daysValue)} day(s) that are not completed.`;
  } else if (daysValue === 0) {
    deadlineSummary.textContent =
      'Showing tasks whose deadline ends today.';
  } else {
    deadlineSummary.textContent =
      `Showing tasks whose deadline ends in ${daysValue} day(s).`;
  }*/
 const operatorLabels = {
  '=': 'exactly',
  '<': 'less than',
  '<=': 'less than or equal to',
  '>': 'greater than',
  '>=': 'greater than or equal to'
};

deadlineSummary.textContent =
  `Showing tasks with deadline offset ${operatorLabels[deadlineOperator]} ${daysValue} day(s).`;

  if (filteredTasks.length === 0) {
    deadlinesList.innerHTML = `
      <div class="empty-state-card">
        <p>No tasks match this deadline filter.</p>
      </div>
    `;
    return;
  }

  deadlinesList.innerHTML = filteredTasks
    .map(task => renderTaskCard(task))
    .join('');

  bindTaskCardActions(deadlinesList);
}

/*function loadDeadlineTasks() {
  const deadlineDaysFilter = document.getElementById('deadlineDaysFilter');
  const deadlineSummary = document.getElementById('deadlineSummary');
  const deadlinesList = document.getElementById('deadlinesList');

  if (!deadlineDaysFilter || !deadlineSummary || !deadlinesList) {
    return;
  }

  let daysValue = parseInt(deadlineDaysFilter.value, 10);
  if (Number.isNaN(daysValue) || daysValue < 0) {
    daysValue = 0;
  }
  deadlineDaysFilter.value = String(daysValue);

  const filteredTasks = getVisibleTasksForCurrentUser(tasksCache)
    .filter(task => {
      const deadlineOffset = getTaskDeadlineOffset(task);

      if (daysValue === 0) {
        return deadlineOffset < 0 && !isTaskFinished(task);
      }

      return deadlineOffset === daysValue - 1 && !isTaskFinished(task);
    })
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  if (daysValue === 0) {
    deadlineSummary.textContent = 'Showing overdue tasks that are not completed.';
  } else if (daysValue === 1) {
    deadlineSummary.textContent = 'Showing tasks whose deadline ends today.';
  } else {
    deadlineSummary.textContent = `Showing tasks whose deadline ends in ${daysValue - 1} day(s).`;
  }

  if (filteredTasks.length === 0) {
    deadlinesList.innerHTML = `
      <div class="empty-state-card">
        <p>No tasks match this deadline filter.</p>
      </div>
    `;
    return;
  }

  deadlinesList.innerHTML = filteredTasks.map(task => renderTaskCard(task)).join('');
  bindTaskCardActions(deadlinesList);
}*/

function renderTaskCard(task) {
  const primaryUser = usersCache.find(u => u.email === task.primaryUser);
  const secondaryUser = task.secondaryUser ? usersCache.find(u => u.email === task.secondaryUser) : null;
  const isPrimary = task.primaryUser === currentUser.email;
  const isSecondary = task.secondaryUser === currentUser.email;
  const isAdmin = currentUserData?.isAdmin;

  const statusClass = {
    pending: 'status-pending',
    accepted: 'status-accepted',
    work_in_progress: 'status-wip',
    partially_completed: 'status-partial',
    completed: 'status-completed',
    closed: 'status-completed',
    rejected: 'status-rejected'
  }[task.status] || 'status-pending';

  const deadline = new Date(task.deadline);
  const today = new Date();
  const remaining = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

  let actions = '';
  if (task.status === 'pending' && isPrimary) {
    // Only primary user can accept/reject task
    actions = `
      <button class="btn primary-btn small-btn accept-task-btn" data-id="${task.id}">Accept</button>
      <button class="btn secondary-btn small-btn reject-task-btn" data-id="${task.id}">Reject</button>
    `;
  }

  return `
    <div class="task-card">
      <div class="task-header">
        <div class="task-id">${task.taskId}</div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          ${task.priority ? `<span class="task-status" style="background: ${task.priority === 'High' ? '#fee2e2' : task.priority === 'Medium' ? '#fef3c7' : '#d1fae5'}; color: ${task.priority === 'High' ? '#dc2626' : task.priority === 'Medium' ? '#d97706' : '#059669'}">Priority: ${task.priority}</span>` : ''}
          <div class="task-status ${statusClass}">${task.status.replace('_', ' ')}</div>
        </div>
      </div>
      <p style="margin-bottom: 1rem;">${task.description}</p>
      <div class="task-meta">
        <span><strong>Primary:</strong> ${primaryUser?.name || task.primaryUser}</span>
        ${secondaryUser ? `<span><strong>Secondary:</strong> ${secondaryUser?.name || task.secondaryUser}</span>` : ''}
        ${task.categoryName ? `<span><strong>Category:</strong> ${task.categoryName}</span>` : ''}
        ${task.projectName ? `<span><strong>Project:</strong> ${task.projectName}</span>` : ''}
        <span><strong>Deadline:</strong> ${task.deadline}</span>
        <span><strong>Remaining:</strong> ${remaining} days</span>
      </div>
      <div class="task-actions">
        <button class="btn secondary-btn small-btn view-task-btn" data-id="${task.id}">View Details</button>
        ${actions}
      </div>
    </div>
  `;
}

function openTaskModal(issueData = null) {
  document.getElementById('taskModalTitle').textContent = 'Create New Task';
  document.getElementById('taskForm').reset();
  
  // Populate user selects
  const primarySelect = document.getElementById('taskPrimary');
  const secondarySelect = document.getElementById('taskSecondary');
  const categorySelect = document.getElementById('taskCategory');
  const projectSelect = document.getElementById('taskProject');
  
  primarySelect.innerHTML = '<option value="">Select Primary User</option>' +
    usersCache.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('');
  secondarySelect.innerHTML = '<option value="">Select Secondary User (Optional)</option>' +
    usersCache.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('');
  categorySelect.innerHTML = '<option value="">Select Project Category</option>' +
    categoriesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  projectSelect.innerHTML = '<option value="">Select Project Name</option>' +
    projectsCache.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  
  // If issue data provided, prefill task form
  if (issueData) {
    const reporter = usersCache.find(u => u.email === issueData.reportedBy);
    const issueDesc = `Issue Description: ${issueData.description}\nObtained From: ${issueData.obtainedFrom}\nReported On: ${issueData.reportedDate}\nReported By: ${reporter?.name || issueData.reportedBy}${issueData.remarks ? '\nRemarks: ' + issueData.remarks : ''}`;
    document.getElementById('taskDescription').value = issueDesc;
    document.getElementById('taskId').value = 'ISSUE-' + Date.now();
    
    // Store issue id to mark it as converted later
    document.getElementById('taskForm').dataset.issueId = issueData.id;
  } else {
    delete document.getElementById('taskForm').dataset.issueId;
  }
  
  document.getElementById('taskModal').classList.remove('hidden');
}

// Flag to prevent duplicate submissions
let isSubmittingTask = false;

async function handleSaveTask(e) {
  e.preventDefault();
  
  if (isSubmittingTask) return;
  isSubmittingTask = true;
  
  const taskId = document.getElementById('taskId').value.trim();
  const description = document.getElementById('taskDescription').value.trim();
  const primaryUser = document.getElementById('taskPrimary').value;
  const secondaryUser = document.getElementById('taskSecondary').value;
  const categoryId = document.getElementById('taskCategory').value;
  const projectId = document.getElementById('taskProject').value;
  const priority = document.getElementById('taskPriority').value;
  const duration = parseInt(document.getElementById('taskDuration').value);
  const remarks = document.getElementById('taskRemarks').value.trim();

  const now = new Date();
  const assignedDate = now.toISOString().split('T')[0];
  const assignedTime = now.toTimeString().split(' ')[0].substring(0, 5);
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + duration);
  const deadlineStr = deadline.toISOString().split('T')[0];

  // Get category and project names
  const category = categoriesCache.find(c => c.id === categoryId);
  const project = projectsCache.find(p => p.id === projectId);

  const trail = [{
    action: 'Task Created',
    user: currentUser.email,
    date: assignedDate,
    time: assignedTime,
    details: 'Task created and assigned'
  }];

  try {
    // Create task
    const taskRef = await db.collection('groups').doc(currentGroup).collection('tasks').add({
      taskId,
      description,
      primaryUser,
      secondaryUser: secondaryUser || null,
      categoryId,
      categoryName: category?.name,
      projectId,
      projectName: project?.name,
      priority,
      duration,
      remarks,
      assignedDate,
      assignedTime,
      deadline: deadlineStr,
      status: 'pending',
      progress: [],
      trail,
      assignmentHistory: [],
      assignedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // If this task was created from an issue, mark the issue as converted
    const issueId = e.target.dataset.issueId;
    if (issueId) {
      await db.collection('groups').doc(currentGroup).collection('issues').doc(issueId).update({
        status: 'converted',
        convertedAt: firebase.firestore.FieldValue.serverTimestamp(),
        convertedToTask: taskRef.id
      });
    }
    
    // Create notifications for assigned users
    await createNotificationForTask(taskRef.id, taskId, primaryUser, secondaryUser);

    document.getElementById('taskModal').classList.add('hidden');
    alert('Task created successfully!');
  } catch (error) {
    console.error('Save task error:', error);
    alert('Failed to create task: ' + error.message);
  } finally {
    isSubmittingTask = false;
  }
}

async function createNotificationForTask(taskId, taskDisplayId, primaryUser, secondaryUser) {
  // Only send notification to primary user initially (secondary gets it after primary accepts)
  if (primaryUser && primaryUser !== currentUser.email) {
    await db.collection('groups').doc(currentGroup)
      .collection('users').doc(primaryUser)
      .collection('notifications').add({
        type: 'task_assigned',
        taskId,
        taskDisplayId,
        message: `You've been assigned as primary user for task ${taskDisplayId}`,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  }
}

async function openViewTaskModal(taskId) {
  const task = tasksCache.find(t => t.id === taskId);
  if (!task) return;
  
  const primaryUser = usersCache.find(u => u.email === task.primaryUser);
  const secondaryUser = task.secondaryUser ? usersCache.find(u => u.email === task.secondaryUser) : null;
  const isAdmin = currentUserData?.isAdmin;
  const isPrimary = task.primaryUser === currentUser.email;
  const isSecondary = task.secondaryUser === currentUser.email;

  // Filter progress updates for admin (only show verified ones)
  let progressToShow = task.progress;
  if (isAdmin) {
    progressToShow = task.progress.filter(p => p.verifiedByPrimary === true);
  }

  let progressHtml = progressToShow.map(p => {
    const isPrimary = p.user === task.primaryUser;
    const isVerificationNote = p.type === 'verification_note';
    const backgroundColor = isPrimary ? '#e0f2fe' : '#f3f4f6';
    const borderColor = isPrimary ? '#0ea5e9' : '#d1d5db';
    const headerColor = isPrimary ? '#0369a1' : '#374151';
    
    return `
      <div class="progress-update" style="background: ${backgroundColor}; border-left: 4px solid ${borderColor};">
        <div class="update-header">
          <strong style="color: ${headerColor};">
            ${usersCache.find(u => u.email === p.user)?.name || p.user}
            ${p.type && p.type !== 'verification_note' ? `(${p.type.replace('_', ' ')})` : ''}
          </strong>
          <span>${p.date} ${p.time}</span>
        </div>
        ${!isVerificationNote && p.status ? `<p><strong>Status:</strong> ${p.status.replace('_', ' ')}</p>` : ''}
        <p>${isVerificationNote ? `<Strong>Verification Note:</Strong> ${p.description}` : p.description}</p>
      </div>
    `;
  }).join('');

 /* let trailHtml = task.trail.map(t => `
    <div class="trail-item">
      <div><strong>${t.action}</strong> by ${usersCache.find(u => u.email === t.user)?.name || t.user}</div>
      <div class="trail-date">${t.date} ${t.time}</div>
      <div>${t.details}</div>
    </div>
  `).join('');*/

  /*let trailHtml = task.trail.map(t => `
  <div class="trail-item">
    <span class="trail-action">${t.action}</span>
    <span class="trail-user">${usersCache.find(u => u.email === t.user)?.name || t.user}</span>
    <span class="trail-datetime">${t.date} ${t.time}</span>
    <span class="trail-details">${t.details}</span>
  </div>
`).join('');*/

//Trail in collapsible table showing only the last entry
const latestTrail = task.trail[task.trail.length - 1];

let trailHtml = `
<div class="trail-section">

  <div class="trail-header"
       onclick="toggleTrail(this)">
    <span>
      Activity Trail (${task.trail.length})
    </span>
    <span class="trail-arrow">▼</span>
  </div>

  <div class="trail-latest">
    <strong>${latestTrail.action}</strong> |
    ${usersCache.find(u => u.email === latestTrail.user)?.name || latestTrail.user}
    |
    ${latestTrail.date} ${latestTrail.time}
    |
    ${latestTrail.details}
  </div>

  <div class="trail-content">
    <table class="trail-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>User</th>
          <th>Date & Time</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${task.trail.map(t => `
          <tr>
            <td>${t.action}</td>
            <td>${usersCache.find(u => u.email === t.user)?.name || t.user}</td>
            <td>${t.date} ${t.time}</td>
            <td>${t.details}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

</div>
`;
  
  // Assignment history (only visible to admins)
  let assignmentHistoryHtml = '';
  if (isAdmin && task.assignmentHistory && task.assignmentHistory.length > 0) {
    assignmentHistoryHtml = `
      <div class="trail-list">
        <h4>Assignment History</h4>
        ${task.assignmentHistory.map(h => `
          <div class="trail-item">
            <div>
  <div>
  <strong>Task Reassigned</strong> from
  <span style="color:#dc2626;font-weight:600;">
    ${usersCache.find(u => u.email === h.previousAssignee)?.name || h.previousAssignee}
  </span>
  to
  <span style="color:#16a34a;font-weight:600;">
    ${usersCache.find(u => u.email === h.newAssignee)?.name || h.newAssignee}
  </span>
  on ${h.date} ${h.time}
</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  let actionsHtml = '';
  if (task.status === 'pending' && isPrimary) {
    actionsHtml = `
      <div style="margin-top: 1.5rem;">
        <div class="input-group" style="margin-bottom: 1rem;">
          <label for="primaryNote">Note from Primary User (optional)</label>
          <textarea id="primaryNote" rows="2" placeholder="Enter your note..." style="width:100%;"></textarea>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn primary-btn" style="flex:1;" onclick="acceptTask('${task.id}')">Accept Task</button>
          <button class="btn secondary-btn" style="flex:1;" onclick="rejectTask('${task.id}')">Reject Task</button>
        </div>
      </div>
    `;
  } else if (isSecondary && (task.status === 'accepted' || task.status === 'work_in_progress' || task.status === 'partially_completed')) {
    actionsHtml = `
      <div style="margin-top: 1.5rem; border-top: 1px solid var(--gray-200); padding-top: 1.5rem;">
        <h4 style="margin-bottom: 1rem;">Update Progress</h4>
        <div class="input-group">
          <label for="progressDesc">Progress Description</label>
          <textarea id="progressDesc" rows="3" placeholder="Describe the progress made..." style="width:100%;"></textarea>
        </div>
        <div class="input-group">
          <label for="progressStatus">Status</label>
          <select id="progressStatus" style="width:100%;">
            <option value="work_in_progress">Work In Progress</option>
            <option value="partially_completed">Partially Completed</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <button class="btn primary-btn" style="width:100%;" onclick="updateProgress('${task.id}')">Update Progress</button>
      </div>
    `;
  } else if (isPrimary && task.progress.length > 0) {
    const lastProgress = task.progress[task.progress.length - 1];
    if (lastProgress.verifiedByPrimary !== true) {
      actionsHtml = `
        <div style="margin-top: 1.5rem;">
          <div class="input-group" style="margin-bottom: 1rem;">
            <label for="primaryNote">Verification Note (optional)</label>
            <textarea id="primaryNote" rows="2" placeholder="Enter your verification note..." style="width:100%;"></textarea>
          </div>
          <button class="btn primary-btn" style="width:100%;" onclick="verifyProgress('${task.id}')">Verify Latest Progress</button>
        </div>
      `;
    }
  }

  // Add "Create Punch List" button if task is open/in progress/on hold (available to all users)
  if (['pending', 'accepted', 'work_in_progress', 'partially_completed'].includes(task.status)) {
    actionsHtml = (actionsHtml || '') + `
      <div style="margin-top: 1rem;">
        <button class="btn primary-btn" style="width:100%;" onclick="openPunchListModal('${task.id}')">Create Punch List</button>
      </div>
    `;
  }

  // Admin actions: close task, delete task
  if (isAdmin) {
    if (!isTaskFinished(task)) {
      actionsHtml = (actionsHtml || '') + `
        <div style="margin-top: 1.5rem; border-top: 1px solid var(--gray-200); padding-top: 1.5rem;">
          <h4 style="margin-bottom: 1rem;">Extend/Shorten Deadline</h4>
          <div class="input-group">
            <label for="extendDeadlineDays">Add More Days</label>
            <input type="number" id="extendDeadlineDays" value="1" placeholder="Enter number of days">
          </div>
          <button class="btn primary-btn" style="width:100%;" onclick="extendTaskDeadline('${task.id}')">Extend/Shorten Deadline</button>
        </div>
      `;
    }

    if (task.status === 'completed' || task.status === 'rejected') {
      actionsHtml = (actionsHtml || '') + `
        <div style="margin-top: 1.5rem;">
          <button class="btn primary-btn" style="width:100%;" onclick="closeTask('${task.id}')">Close Task</button>
        </div>
      `;
    }
    // Add delete button
    actionsHtml = (actionsHtml || '') + `
      <div style="margin-top: 1rem;">
        <button class="btn secondary-btn" style="width:100%; background: var(--danger-100); color: var(--danger-600); border: none;" onclick="deleteTask('${task.id}')">Delete Task</button>
      </div>
    `;
    // Add "Create New Task from Task" button
    actionsHtml = (actionsHtml || '') + `
      <div style="margin-top: 1rem;">
        <button class="btn primary-btn" style="width:100%;" onclick="openCreateTaskFromTask('${task.id}')">Create New Task from this Task</button>
      </div>
    `;
     
    // Admin reassignment (only if task is not rejected)
    if (/*task.status !== 'rejected' &&*/ !isTaskFinished(task)) {
      actionsHtml = (actionsHtml || '') + `
        <div style="margin-top: 1.5rem; border-top: 1px solid var(--gray-200); padding-top: 1.5rem;">
          <h4 style="margin-bottom: 1rem;">Reassign Task</h4>
          <div class="input-group">
            <label for="reassignPrimary">New Primary User</label>
            <select id="reassignPrimary" style="width:100%;">
              <option value="${task.primaryUser}">Current: ${primaryUser?.name || task.primaryUser}</option>
              ${usersCache.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('')}
            </select>
          </div>
          <div class="input-group">
            <label for="reassignSecondary">New Secondary User</label>
            <select id="reassignSecondary" style="width:100%;">
              <option value="">${secondaryUser ? 'Current: ' + secondaryUser.name : 'None'}</option>
              <option value="">None</option>
              ${usersCache.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('')}
            </select>
          </div>
          <button class="btn primary-btn" style="width:100%;" onclick="reassignTask('${task.id}')">Reassign Task</button>
        </div>
      `;
    }
  }

  const content = document.getElementById('viewTaskContent');
  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
      <h2 style="color: var(--primary); margin:0;">${task.taskId}</h2>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        ${task.priority ? `<span class="task-status" style="background: ${task.priority === 'High' ? '#fee2e2' : task.priority === 'Medium' ? '#fef3c7' : '#d1fae5'}; color: ${task.priority === 'High' ? '#dc2626' : task.priority === 'Medium' ? '#d97706' : '#059669'}">Priority: ${task.priority}</span>` : ''}
        <span class="task-status status-${task.status.replace('_', '-')}">${task.status.replace('_', ' ')}</span>
      </div>
    </div>
    <p style="margin-bottom: 1.25rem; font-size: 1rem; line-height: 1.6;">${task.description}</p>
    <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.25rem;">
      <div><strong>Primary User:</strong> ${primaryUser?.name || task.primaryUser}</div>
      <div><strong>Secondary User:</strong> ${secondaryUser?.name || 'Not assigned'}</div>
      <div><strong>Category:</strong> ${task.categoryName || 'Not assigned'}</div>
      <div><strong>Project:</strong> ${task.projectName || 'Not assigned'}</div>
      <div><strong>Assigned On:</strong> ${task.assignedDate} ${task.assignedTime}</div>
      <div><strong>Deadline:</strong> ${task.deadline}</div>
      <div><strong>Duration:</strong> ${task.duration} days</div>
    </div>
    ${task.remarks ? `<p><strong>Remarks:</strong> ${task.remarks}</p>` : ''}
    
    <div style="margin-top: 1.5rem; border-top: 1px solid var(--gray-200); padding-top: 1.5rem;">
      <h4 style="margin-bottom: 1rem;">Progress Updates</h4>
      ${progressHtml || '<p style="color: var(--gray-500);">No progress updates yet</p>'}
    </div>
    
    <div class="trail-list">
      <h4>Trail</h4>
      ${trailHtml}
    </div>
    
    ${assignmentHistoryHtml}
    
    ${actionsHtml}
  `;

  document.getElementById('viewTaskModal').classList.remove('hidden');
}

function toggleTrail(header) {
  const section = header.closest('.trail-section');
  const content = section.querySelector('.trail-content');
  const arrow = header.querySelector('.trail-arrow');

  content.classList.toggle('expanded');

  arrow.textContent =
    content.classList.contains('expanded')
      ? '▲'
      : '▼';
}

window.acceptTask = async function(taskId) {
  const task = tasksCache.find(t => t.id === taskId);
  const taskDisplayId = task?.taskId || taskId;
  const note = document.getElementById('primaryNote')?.value.trim();
  
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  
  const updates = {
    status: 'accepted',
    trail: firebase.firestore.FieldValue.arrayUnion({
      action: 'Task Accepted',
      user: currentUser.email,
      date,
      time,
      details: 'User accepted the task'
    })
  };
  
  if (note) {
    updates.progress = firebase.firestore.FieldValue.arrayUnion({
      user: currentUser.email,
      date,
      time,
      description: note,
      status: 'accepted',
      type: 'accept_note',
      verifiedByPrimary: true
    });
  }
  
  await db.collection('groups').doc(currentGroup).collection('tasks').doc(taskId).update(updates);
  
  // Send notification to secondary user if one is assigned
  if (task && task.secondaryUser && task.secondaryUser !== currentUser.email) {
    await db.collection('groups').doc(currentGroup)
      .collection('users').doc(task.secondaryUser)
      .collection('notifications').add({
        type: 'task_assigned',
        taskId,
        taskDisplayId,
        message: `You've been assigned as secondary user for task ${taskDisplayId}`,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  }

  await notifyAdmins({
    type: 'task_accepted_admin',
    taskId,
    taskDisplayId,
    message: `Task ${taskDisplayId} was accepted by ${usersCache.find(u => u.email === currentUser.email)?.name || currentUser.email}`
  });
  
  document.getElementById('viewTaskModal').classList.add('hidden');
}

window.rejectTask = async function(taskId) {
  const task = tasksCache.find(t => t.id === taskId);
  const note = document.getElementById('primaryNote')?.value.trim();
  
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  
  const updates = {
    status: 'rejected',
    trail: firebase.firestore.FieldValue.arrayUnion({
      action: 'Task Rejected',
      user: currentUser.email,
      date,
      time,
      details: 'User rejected the task'
    })
  };
  
  if (note) {
    updates.progress = firebase.firestore.FieldValue.arrayUnion({
      user: currentUser.email,
      date,
      time,
      description: note,
      status: 'rejected',
      type: 'reject_note',
      verifiedByPrimary: true
    });
  }
  
  await db.collection('groups').doc(currentGroup).collection('tasks').doc(taskId).update(updates);
  
  document.getElementById('viewTaskModal').classList.add('hidden');
}

window.deleteTask = async function(taskId) {
  if (!confirm('Are you sure you want to delete this task? This cannot be undone!')) {
    return;
  }

  try {
    await db.collection('groups').doc(currentGroup).collection('tasks').doc(taskId).delete();
    alert('Task deleted successfully!');
    document.getElementById('viewTaskModal').classList.add('hidden');
  } catch (error) {
    console.error('Delete task error:', error);
    alert('Failed to delete task: ' + error.message);
  }
}

window.extendTaskDeadline = async function(taskId) {
  const task = tasksCache.find(t => t.id === taskId);
  const extraDays = parseInt(document.getElementById('extendDeadlineDays')?.value, 10);

  if (!task) {
    return;
  }

  /*if (Number.isNaN(extraDays) || extraDays < 1) {*/
  if (Number.isNaN(extraDays)) {
    alert('Please enter a valid number of days to extend.');
    return;
  }

  const currentDeadline = new Date(task.deadline);
  currentDeadline.setDate(currentDeadline.getDate() + extraDays);
  const newDeadline = currentDeadline.toISOString().split('T')[0];

  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);

  try {
    await db.collection('groups').doc(currentGroup).collection('tasks').doc(taskId).update({
      deadline: newDeadline,
      duration: (parseInt(task.duration, 10) || 0) + extraDays,
      trail: firebase.firestore.FieldValue.arrayUnion({
        action: 'Deadline Extended',
        user: currentUser.email,
        date,
        time,
        details: `Deadline extended from ${task.deadline} to ${newDeadline}`
      })
    });

    document.getElementById('viewTaskModal').classList.add('hidden');
  } catch (error) {
    console.error('Extend deadline error:', error);
    alert('Failed to extend deadline: ' + error.message);
  }
}

async function deleteIssue(issueId) {
  if (!confirm('Are you sure you want to delete this issue? This cannot be undone!')) {
    return;
  }

  try {
    await db.collection('groups').doc(currentGroup).collection('issues').doc(issueId).delete();
    alert('Issue deleted successfully!');
  } catch (error) {
    console.error('Delete issue error:', error);
    alert('Failed to delete issue: ' + error.message);
  }
}

// ------------------------------
// Punch List Functions
// ------------------------------
let currentPunchListItems = [];

function openPunchListModal(taskId = null) {
  document.getElementById('punchListModalTitle').textContent = 'Create New Punch List';
  document.getElementById('punchListForm').reset();
  document.getElementById('punchListId').value = '';
  document.getElementById('punchListFromTaskId').value = taskId || '';
  currentPunchListItems = [];
  renderPunchListItemsInForm();

  // Auto-fill name and description if taskId is provided
  if (taskId) {
    const task = tasksCache.find(t => t.id === taskId);
    if (task) {
      // Auto-fill punchlist description with task description
      if (task.description) {
        document.getElementById('punchListDescription').value = task.description;
      }
      // Auto-fill punchlist name with task's project name
      if (task.project) {
        const project = projectsCache.find(p => p.id === task.project);
        if (project) {
          document.getElementById('punchListName').value = project.name;
        }
      }
    }
  }

  document.getElementById('punchListModal').classList.remove('hidden');
}

function openEditPunchListModal(punchListId) {
  const punchList = punchListsCache.find(pl => pl.id === punchListId);
  if (!punchList) return;
  
  document.getElementById('punchListModalTitle').textContent = 'Edit Punch List';
  document.getElementById('punchListId').value = punchListId;
  document.getElementById('punchListName').value = punchList.name;
  document.getElementById('punchListDescription').value = punchList.description || '';
  document.getElementById('punchListVisibility').value = punchList.visibility || 'public';
  currentPunchListItems = [...(punchList.items || [])];
  renderPunchListItemsInForm();
  document.getElementById('punchListModal').classList.remove('hidden');
}

function addPunchListItemToForm() {
  const newItem = {
    id: Date.now().toString(),
    description: '',
    completed: false
  };
  currentPunchListItems.push(newItem);
  renderPunchListItemsInForm();
}

function renderPunchListItemsInForm() {
  const container = document.getElementById('punchListItems');
  if (!container) return;
  
  container.innerHTML = currentPunchListItems.map((item, index) => `
    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;">
      <div style="min-width: 30px; font-weight: bold; text-align: center;">${index + 1}.</div>
      <input type="text" value="${item.description}" placeholder="Item description" 
             style="flex: 1; padding: 0.5rem; border: 1px solid var(--gray-300); border-radius: 0.5rem;"
             onchange="updatePunchListItem('${item.id}', this.value)">
      <button type="button" class="btn secondary-btn small-btn" 
              onclick="removePunchListItem('${item.id}')">Remove</button>
    </div>
  `).join('');
}

function updatePunchListItem(id, description) {
  const item = currentPunchListItems.find(i => i.id === id);
  if (item) item.description = description;
}

function removePunchListItem(id) {
  currentPunchListItems = currentPunchListItems.filter(i => i.id !== id);
  renderPunchListItemsInForm();
}

async function handleSavePunchList(e) {
  e.preventDefault();
  
  const name = document.getElementById('punchListName').value.trim();
  const description = document.getElementById('punchListDescription').value.trim();
  const visibility = document.getElementById('punchListVisibility').value;
  const punchListId = document.getElementById('punchListId').value;
  const fromTaskId = document.getElementById('punchListFromTaskId').value;
  
  if (!name) {
    alert('Please enter a punch list name');
    return;
  }
  
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  
  try {
    if (punchListId) {
      // Update existing
      await db.collection('groups').doc(currentGroup).collection('punchLists').doc(punchListId).update({
        name,
        description,
        visibility,
        items: currentPunchListItems,
        lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdatedDate: date,
        lastUpdatedTime: time
      });
    } else {
      // Create new
      // Get next ID (PL-XXXXXX)
      let nextNumber = 1;
      const maxPunchList = punchListsCache.reduce((max, pl) => {
        if (pl.punchListId && pl.punchListId.startsWith('PL-')) {
          const num = parseInt(pl.punchListId.slice(3), 10);
          return num > max ? num : max;
        }
        return max;
      }, 0);
      nextNumber = maxPunchList + 1;
      const newPunchListId = 'PL-' + String(nextNumber).padStart(6, '0');
      
      const docRef = await db.collection('groups').doc(currentGroup).collection('punchLists').add({
        punchListId: newPunchListId,
        name,
        description,
        visibility,
        items: currentPunchListItems,
        taskId: fromTaskId || null,
        createdBy: currentUser.email,
        createdDate: date,
        createdTime: time,
        lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdatedDate: date,
        lastUpdatedTime: time,
        status: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    document.getElementById('punchListModal').classList.add('hidden');
    alert('Punch list saved successfully!');
  } catch (error) {
    console.error('Save punch list error:', error);
    alert('Failed to save punch list: ' + error.message);
  }
}

function calculatePunchListProgress(punchList) {
  const items = punchList.items || [];
  if (items.length === 0) return 0;
  const completedCount = items.filter(i => i.completed).length;
  return Math.round((completedCount / items.length) * 100);
}

function getTimeAgo(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  return 'Just now';
}

function renderPunchLists() {
  // Filter for visible punch lists first
  const visiblePunchLists = punchListsCache.filter(pl => 
    pl.visibility === 'public' || pl.createdBy === currentUser.email
  );
  
  const metricsContainer = document.getElementById('punchListsMetricsGrid');
  if (metricsContainer) {
    const total = visiblePunchLists.length;
    const active = visiblePunchLists.filter(pl => pl.status === 'active').length;
    const completed = visiblePunchLists.filter(pl => {
      const progress = calculatePunchListProgress(pl);
      return progress === 100;
    }).length;
    const archived = visiblePunchLists.filter(pl => pl.status === 'archived').length;


  const completionPercent =
  total > 0 ? Math.round((completed / total) * 100) : 0;

  let progressringcolor;

if (completionPercent < 25) {
  progressringcolor = '#ef4444'; // red
} else if (completionPercent < 50) {
  progressringcolor = '#f97316'; // orange
} else if (completionPercent < 75) {
  progressringcolor = '#eab308'; // yellow
} else if (completionPercent < 100) {
  progressringcolor = '#22c55e'; // green
} else {
  progressringcolor = '#16a34a'; // dark green 
}

metricsContainer.innerHTML = `
<div class="dashboard-overview">

  <div class="metrics-left">

    <div class="metrics-header">
      <div class="metrics-header-icon">
        <i class="fas fa-tachometer-alt"></i>
      </div>
      <div>
        <h2>Dashboard Overview</h2>
        <p>Punch List Summary Dashboard</p>
      </div>
    </div>

    <div class="metrics-grid">

      <div class="metrics-card total-card">
        <div class="card-icon">
          <i class="fas fa-clipboard-list"></i>
        </div>

        <h3>Total</h3>
        <div class="metrics-number">${total}</div>

        <div class="card-footer">
          <i class="fas fa-user-friends"></i>
          <span>All items in the system</span>
        </div>
      </div>

      <div class="metrics-card active-card">
        <div class="card-icon">
          <i class="fas fa-heartbeat"></i>
        </div>

        <h3>Active</h3>
        <div class="metrics-number">${active}</div>

        <div class="card-footer">
          <i class="fas fa-play"></i>
          <span>Currently active items</span>
        </div>
      </div>

      <div class="metrics-card archived-card">
        <div class="card-icon">
          <i class="fas fa-archive"></i>
        </div>

        <h3>Archived</h3>
        <div class="metrics-number">${archived}</div>

        <div class="card-footer">
          <i class="fas fa-box"></i>
          <span>Archived items</span>
        </div>
      </div>

      <div class="metrics-card completed-card">
        <div class="card-icon">
          <i class="fas fa-check-double"></i>
        </div>

        <h3>Completed</h3>
        <div class="metrics-number">${completed}</div>

        <div class="card-footer">
          <i class="fas fa-check-circle"></i>
          <span>Successfully completed</span>
        </div>
      </div>

    </div>

  </div>

  <div class="completion-card">

    <div class="completion-header">
      <h2>Completion Overview</h2>
      <p>Percentage of tasks completed</p>
    </div>

    <div class="progress-ring"
     style="
       --progress:${completionPercent};
       --progress-color:${progressringcolor};
     ">

      <div class="progress-center">
        <div class="progress-value">${completionPercent}%</div>
        <div class="progress-label">Completed</div>
        <div class="progress-count">${completed} of ${total} tasks</div>
      </div>
    </div>

   <div class="completion-footer"
     style="color:${progressringcolor};">
  <i class="fas fa-arrow-trend-up"></i>
  <span>${completionPercent}% completion rate</span>
</div>

  </div>

</div>
`;
    /*metricsContainer.innerHTML = `
      <div class="metrics-card">
        <h3>Total</h3>
        <p class="metrics-number">${total}</p>
      </div>
      <div class="metrics-card">
        <h3>Active</h3>
        <p class="metrics-number">${active}</p>
      </div>
      <div class="metrics-card">
        <h3>Completed</h3>
        <p class="metrics-number">${completed}</p>
      </div>
      <div class="metrics-card">
        <h3>Archived</h3>
        <p class="metrics-number">${archived}</p>
      </div>
    `;*/
  }
  
  const activePunchLists = visiblePunchLists.filter(pl => pl.status === 'active');
  const archivedPunchLists = visiblePunchLists.filter(pl => pl.status === 'archived');
  
  // Render card view
  const cardContainer = document.getElementById('punchListCardView');
  if (cardContainer) {
    if (activePunchLists.length === 0) {
      cardContainer.innerHTML = `
        <div class="empty-state-card">
          <p>No punch lists yet. Create one!</p>
        </div>
      `;
    } else {
      cardContainer.innerHTML = activePunchLists.map(pl => {
        const progress = calculatePunchListProgress(pl);
        const createdByName = usersCache.find(u => u.email === pl.createdBy)?.name || pl.createdBy;
        
        return `
          <div class="user-card" style="cursor: pointer;" onclick="openViewPunchListModal('${pl.id}')">
            <h3 style="margin-bottom: 0.5rem;">${pl.punchListId}</h3>
            <p style="font-weight: bold; margin-bottom: 0.5rem;">${pl.name}</p>
            <div style="margin-bottom: 1rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span>Progress</span>
                <span>${progress}%</span>
              </div>
              <div style="width: 100%; height: 8px; background: var(--gray-200); border-radius: 4px; overflow: hidden;">
                <div style="width: ${progress}%; height: 100%; background: var(--primary-500);"></div>
              </div>
            </div>
            <div style="margin-bottom: 0.5rem; font-size: 0.875rem; color: var(--gray-600);">
              <div><strong>Created by:</strong> ${createdByName}</div>
              <div><strong>Visibility:</strong> ${pl.visibility}</div>
              <div><strong>Updated:</strong> ${getTimeAgo(pl.lastUpdatedAt)}</div>
            </div>
            ${pl.createdBy === currentUser.email ? `
              <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                <button class="btn secondary-btn small-btn" onclick="event.stopPropagation(); openEditPunchListModal('${pl.id}')">Edit</button>
                <button class="btn secondary-btn small-btn" onclick="event.stopPropagation(); archivePunchList('${pl.id}')">Archive</button>
                <button class="btn secondary-btn small-btn" style="background: var(--danger-100); color: var(--danger-600);" onclick="event.stopPropagation(); deletePunchList('${pl.id}')">Delete</button>
              </div>
            ` : ''}
          </div>
        `;


/*
        return `
<div class="user-card punchlist-card"
     onclick="openViewPunchListModal('${pl.id}')">

  <div class="punchlist-header">

    <div>
      <div class="punchlist-id">${pl.punchListId}</div>
      <div class="punchlist-title">${pl.name}</div>
    </div>

    <div class="punchlist-visibility ${pl.visibility}">
      ${pl.visibility}
    </div>

  </div>

  <div class="punchlist-progress">

    <div class="punchlist-progress-header">
      <span>Progress</span>
      <span>${progress}%</span>
    </div>

    <div class="punchlist-progress-bar">
      <div class="punchlist-progress-fill"
           style="width:${progress}%">
      </div>
    </div>

  </div>

  <div class="punchlist-meta">

    <div class="punchlist-meta-row">
      <span>Created By</span>
      <strong>${createdByName}</strong>
    </div>

    <div class="punchlist-meta-row">
      <span>Last Updated</span>
      <strong>${getTimeAgo(pl.lastUpdatedAt)}</strong>
    </div>

  </div>

  ${
    pl.createdBy === currentUser.email
      ? `
      <div class="punchlist-actions">
        <button class="btn secondary-btn small-btn"
                onclick="event.stopPropagation(); openEditPunchListModal('${pl.id}')">
          Edit
        </button>

        <button class="btn secondary-btn small-btn"
                onclick="event.stopPropagation(); archivePunchList('${pl.id}')">
          Archive
        </button>

        <button class="btn secondary-btn small-btn"
                style="background:var(--danger-100);color:var(--danger-600);"
                onclick="event.stopPropagation(); deletePunchList('${pl.id}')">
          Delete
        </button>
      </div>
      `
      : ''
  }

</div>
`;*/

      }).join('');
    }
  }
  
  // Render list view
  const tableBody = document.getElementById('punchListTableBody');
  if (tableBody) {
    if (activePunchLists.length === 0) {
      tableBody.innerHTML = '';
    } else {
      tableBody.innerHTML = activePunchLists.map(pl => {
        const progress = calculatePunchListProgress(pl);
        const createdByName = usersCache.find(u => u.email === pl.createdBy)?.name || pl.createdBy;
        
        return `
          <tr style="border-bottom: 1px solid var(--gray-200);">
            <td style="padding: 1rem; font-weight: bold;">${pl.punchListId}</td>
            <td style="padding: 1rem;">${pl.name}</td>
            <td style="padding: 1rem;">${pl.visibility}</td>
            <td style="padding: 1rem;">${progress}%</td>
            <td style="padding: 1rem;">${createdByName}</td>
            <td style="padding: 1rem;">${pl.createdDate} ${pl.createdTime}</td>
            <td style="padding: 1rem;">
              <button class="btn secondary-btn small-btn" onclick="openViewPunchListModal('${pl.id}')">View</button>
              ${pl.createdBy === currentUser.email ? `
                <button class="btn secondary-btn small-btn" onclick="openEditPunchListModal('${pl.id}')">Edit</button>
                <button class="btn secondary-btn small-btn" onclick="archivePunchList('${pl.id}')">Archive</button>
              ` : ''}
            </td>
          </tr>
        `;
      }).join('');
    }
  }
  
  // Render archived punch lists
  const archivedContainer = document.getElementById('archivedPunchListsList');
  if (archivedContainer) {
    if (archivedPunchLists.length === 0) {
      archivedContainer.innerHTML = '';
    } else {
      archivedContainer.innerHTML = archivedPunchLists.map(pl => {
        const progress = calculatePunchListProgress(pl);
        const createdByName = usersCache.find(u => u.email === pl.createdBy)?.name || pl.createdBy;
        
        return `
          <div class="user-card">
            <h3 style="margin-bottom: 0.5rem;">${pl.punchListId} (Archived)</h3>
            <p style="font-weight: bold; margin-bottom: 0.5rem;">${pl.name}</p>
            <div style="margin-bottom: 1rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span>Progress</span>
                <span>${progress}%</span>
              </div>
              <div style="width: 100%; height: 8px; background: var(--gray-200); border-radius: 4px; overflow: hidden;">
                <div style="width: ${progress}%; height: 100%; background: var(--primary-500);"></div>
              </div>
            </div>
            <div style="margin-bottom: 0.5rem; font-size: 0.875rem; color: var(--gray-600);">
              <div><strong>Created by:</strong> ${createdByName}</div>
              <div><strong>Visibility:</strong> ${pl.visibility}</div>
            </div>
            ${pl.createdBy === currentUser.email ? `
              <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                <button class="btn secondary-btn small-btn" onclick="restorePunchList('${pl.id}')">Restore</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }
  }
}

function openViewPunchListModal(punchListId) {
  const punchList = punchListsCache.find(pl => pl.id === punchListId);
  if (!punchList) return;
  
  const progress = calculatePunchListProgress(punchList);
  const createdByName = usersCache.find(u => u.email === punchList.createdBy)?.name || punchList.createdBy;
  
  const content = document.getElementById('viewPunchListContent');
  if (!content) return;
  
  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
      <div>
        <h2 style="color: var(--primary); margin:0;">${punchList.punchListId}</h2>
        <p style="font-size: 1.25rem; font-weight: bold; margin: 0.5rem 0 1rem 0;">${punchList.name}</p>
      </div>
      <span class="task-status" style="background: var(--gray-100); color: var(--gray-700);">${punchList.visibility}</span>
    </div>
    ${punchList.description ? `<p style="margin-bottom: 1rem; white-space: pre-wrap;">${punchList.description}</p>` : ''}
    <div style="margin-bottom: 1.5rem;">
      <h3 style="margin-bottom: 1rem;">Progress: ${progress}%</h3>
      <div style="width: 100%; height: 16px; background: var(--gray-200); border-radius: 8px; overflow: hidden;">
        <div style="width: ${progress}%; height: 100%; background: var(--primary-500);"></div>
      </div>
    </div>
    <h4 style="margin-bottom: 1rem;">Items</h4>
    ${(punchList.items || []).length === 0 ? `
      <p style="color: var(--gray-500);">No items yet.</p>
    ` : `
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${(punchList.items || []).map((item, index) => `
          <div style="display: flex; gap: 0.75rem; align-items: start; padding: 0.75rem; background: var(--gray-50); border-radius: 0.5rem;">
            <input type="checkbox" ${item.completed ? 'checked' : ''} 
                   style="transform: scale(1.5); margin-top: 0.25rem;"
                   ${punchList.createdBy !== currentUser.email ? 'disabled' : ''}
                   onchange="togglePunchListItem('${punchList.id}', '${item.id}', this.checked)">
            <div style="flex: 1;">
              <div style="font-weight: ${item.completed ? 'normal' : 'bold'}; text-decoration: ${item.completed ? 'line-through' : 'none'}; color: ${item.completed ? 'var(--gray-500)' : 'inherit'};">
                ${index + 1}. ${item.description}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `}
    <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--gray-200); display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
      <div><strong>Created by:</strong> ${createdByName}</div>
      <div><strong>Created on:</strong> ${punchList.createdDate} ${punchList.createdTime}</div>
      <div><strong>Last updated:</strong> ${punchList.lastUpdatedDate || 'N/A'} ${punchList.lastUpdatedTime || ''}</div>
    </div>
  `;
  
  document.getElementById('viewPunchListModal').classList.remove('hidden');
}

window.togglePunchListItem = async function(punchListId, itemId, completed) {
  const punchList = punchListsCache.find(pl => pl.id === punchListId);
  if (!punchList) return;
  
  // Check if current user is the creator
  if (punchList.createdBy !== currentUser.email) {
    alert('Only the creator can update checklist items!');
    return;
  }
  
  // Update the cache immediately for instant UI feedback
  const updatedItems = (punchList.items || []).map(item => 
    item.id === itemId ? { ...item, completed } : item
  );
  punchList.items = updatedItems;
  
  // Re-render the modal content if it's open
  if (!document.getElementById('viewPunchListModal').classList.contains('hidden')) {
    openViewPunchListModal(punchListId);
  }
  
  // Update Firestore
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  
  await db.collection('groups').doc(currentGroup).collection('punchLists').doc(punchListId).update({
    items: updatedItems,
    lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastUpdatedDate: date,
    lastUpdatedTime: time
  });
}

window.archivePunchList = async function(punchListId) {
  if (!confirm('Are you sure you want to archive this punch list?')) return;
  
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  
  await db.collection('groups').doc(currentGroup).collection('punchLists').doc(punchListId).update({
    status: 'archived',
    lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastUpdatedDate: date,
    lastUpdatedTime: time
  });
}

window.restorePunchList = async function(punchListId) {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  
  await db.collection('groups').doc(currentGroup).collection('punchLists').doc(punchListId).update({
    status: 'active',
    lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastUpdatedDate: date,
    lastUpdatedTime: time
  });
}

window.deletePunchList = async function(punchListId) {
  if (!confirm('Are you sure you want to delete this punch list? This cannot be undone!')) return;
  
  await db.collection('groups').doc(currentGroup).collection('punchLists').doc(punchListId).delete();
  alert('Punch list deleted successfully!');
}

// ===============================
// Notes Functions
// ===============================

window.openNoteModal = function(noteId = null) {
  if (noteId) {
    const note = notesCache.find(n => n.id === noteId);
    if (!note) return;
    document.getElementById('noteModalTitle').textContent = 'Edit Note';
    document.getElementById('noteId').value = noteId;
    document.getElementById('noteName').value = note.name;
    document.getElementById('noteVisibility').value = note.visibility || 'private';
    document.getElementById('noteDescription').innerHTML = note.description || '';
  } else {
    document.getElementById('noteModalTitle').textContent = 'Create New Note';
    document.getElementById('noteForm').reset();
    document.getElementById('noteId').value = '';
    document.getElementById('noteDescription').innerHTML = '';
  }
  document.getElementById('noteModal').classList.remove('hidden');
}

async function handleSaveNote(e) {
  e.preventDefault();
  
  const name = document.getElementById('noteName').value.trim();
  const visibility = document.getElementById('noteVisibility').value;
  const description = document.getElementById('noteDescription').innerHTML;
  const noteId = document.getElementById('noteId').value;
  
  if (!name) {
    alert('Please enter a note name');
    return;
  }
  
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  
  try {
    if (noteId) {
      // Update existing note
      await db.collection('groups').doc(currentGroup).collection('notes').doc(noteId).update({
        name,
        visibility,
        description,
        lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdatedDate: date,
        lastUpdatedTime: time
      });
    } else {
      // Create new note
      // Generate note ID: NOTE-XXXXXX (using all notes in group for increment, not just visible)
      let nextNumber = 1;
      const maxNote = notesCache.reduce((max, note) => {
        if (note.noteId && note.noteId.startsWith('NOTE-')) {
          const num = parseInt(note.noteId.slice(5), 10);
          return num > max ? num : max;
        }
        return max;
      }, 0);
      nextNumber = maxNote + 1;
      const newNoteId = 'NOTE-' + String(nextNumber).padStart(6, '0');
      
      await db.collection('groups').doc(currentGroup).collection('notes').add({
        noteId: newNoteId,
        name,
        visibility,
        description,
        createdBy: currentUser.email,
        createdDate: date,
        createdTime: time,
        lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdatedDate: date,
        lastUpdatedTime: time,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    document.getElementById('noteModal').classList.add('hidden');
    alert('Note saved successfully!');
  } catch (error) {
    console.error('Save note error:', error);
    alert('Failed to save note: ' + error.message);
  }
}

function exportNoteToPdf() {
  const noteName = document.getElementById('noteName').value || 'note';
  const content = document.getElementById('noteDescription');
  if (!content.innerHTML.trim()) {
    alert('Cannot export an empty note!');
    return;
  }
  
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const filename = `${noteName}_${year}${month}${day}${hours}${minutes}${seconds}.pdf`;
  
  const element = document.createElement('div');
  element.style.padding = '2rem';
  element.innerHTML = `
    <h1 style="font-family: Arial, sans-serif; color: #1e293b; margin-bottom: 1rem;">${noteName}</h1>
    <div style="font-family: Arial, sans-serif;">
      ${content.innerHTML}
    </div>
  `;
  
  const opt = {
    margin: 0.5,
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };
  
  html2pdf().set(opt).from(element).save(filename);
}

function loadNotes() {
  // Filter visible notes first
  const visibleNotes = notesCache.filter(note => 
    note.visibility === 'public' || note.createdBy === currentUser.email
  );
  
  // Apply search and filters
  let filtered = [...visibleNotes];
  const search = document.getElementById('noteSearch')?.value?.toLowerCase() || '';
  if (search) {
    filtered = filtered.filter(note => 
      note.name.toLowerCase().includes(search) || 
      (note.description && note.description.toLowerCase().includes(search))
    );
  }
  
  const visibilityFilter = document.getElementById('noteVisibilityFilter')?.value || '';
  if (visibilityFilter) {
    filtered = filtered.filter(note => note.visibility === visibilityFilter);
  }
  
  const createdByFilter = document.getElementById('noteCreatedByFilter')?.value || '';
  if (createdByFilter) {
    filtered = filtered.filter(note => note.createdBy === createdByFilter);
  }
  
  renderNotes(filtered);
}

function renderNotes(notes) {
  const container = document.getElementById('notesList');
  if (!container) return;
  
  if (notes.length === 0) {
    container.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 2rem;">No notes found</p>';
    return;
  }
  
  container.innerHTML = notes.map(note => {
    const createdByName = usersCache.find(u => u.email === note.createdBy)?.name || note.createdBy;
    const isOwner = note.createdBy === currentUser.email;
    
    // Strip HTML for preview
    let previewText = '';
    if (note.description) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = note.description;
      previewText = tempDiv.textContent || tempDiv.innerText || '';
      if (previewText.length > 150) {
        previewText = previewText.substring(0, 150) + '...';
      }
    }
    
    return `
      <div class="note-card" onclick="openViewNoteModal('${note.id}')">
        <div class="note-card-header">
          <h3 class="note-card-title">${note.name}</h3>
          <span class="note-card-visibility ${note.visibility}">${note.visibility}</span>
        </div>
        <div class="note-card-description">${previewText}</div>
        <div class="note-card-footer">
          <div class="note-card-meta">
            <div>Created by: ${createdByName}</div>
            <div>Created: ${note.createdDate} ${note.createdTime}</div>
          </div>
          ${isOwner ? `
            <div class="note-card-actions">
              <button class="btn secondary-btn small-btn" onclick="event.stopPropagation(); openNoteModal('${note.id}')">Edit</button>
              <button class="btn secondary-btn small-btn" style="background: var(--danger-100); color: var(--danger-600);" onclick="event.stopPropagation(); deleteNote('${note.id}')">Delete</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

window.openViewNoteModal = function(noteId) {
  const note = notesCache.find(n => n.id === noteId);
  if (!note) return;
  
  const createdByName = usersCache.find(u => u.email === note.createdBy)?.name || note.createdBy;
  const content = document.getElementById('viewNoteContent');
  if (!content) return;
  
  content.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
        <h2 style="color: #1e293b; margin: 0;">${note.name}</h2>
        <span class="note-card-visibility ${note.visibility}" style="margin: 0;">${note.visibility}</span>
      </div>
      <p style="color: #64748b; font-size: 0.875rem;">
        Created by: <strong>${createdByName}</strong> on ${note.createdDate} ${note.createdTime}
      </p>
    </div>
    <div style="border-top: 1px solid var(--gray-200); padding-top: 1rem;">
      ${note.description || '<p style="color: #9ca3af;">No description</p>'}
    </div>
    ${note.createdBy === currentUser.email ? `
      <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem;">
        <button class="btn secondary-btn" onclick="openNoteModal('${note.id}'); document.getElementById('viewNoteModal').classList.add('hidden');">Edit</button>
        <button class="btn secondary-btn" style="background: var(--danger-100); color: var(--danger-600);" onclick="deleteNote('${note.id}'); document.getElementById('viewNoteModal').classList.add('hidden');">Delete</button>
      </div>
    ` : ''}
  `;
  
  document.getElementById('viewNoteModal').classList.remove('hidden');
}

window.deleteNote = async function(noteId) {
  if (!confirm('Are you sure you want to delete this note? This cannot be undone!')) return;
  
  await db.collection('groups').doc(currentGroup).collection('notes').doc(noteId).delete();
  alert('Note deleted successfully!');
}

function populateNoteCreatedByFilter() {
  const filter = document.getElementById('noteCreatedByFilter');
  if (!filter) return;
  
  const currentValue = filter.value;
  
  // Get all unique creators from visible notes
  const visibleNotes = notesCache.filter(note => 
    note.visibility === 'public' || note.createdBy === currentUser.email
  );
  const creators = [...new Set(visibleNotes.map(note => note.createdBy))];
  
  filter.innerHTML = `<option value="">All Creators</option>` +
    creators.map(email => {
      const user = usersCache.find(u => u.email === email);
      const name = user?.name || email;
      return `<option value="${email}" ${email === currentValue ? 'selected' : ''}>${name}</option>`;
    }).join('');
}



window.closeTask = async function(taskId) {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  
  await db.collection('groups').doc(currentGroup).collection('tasks').doc(taskId).update({
    status: 'closed',
    trail: firebase.firestore.FieldValue.arrayUnion({
      action: 'Task Closed',
      user: currentUser.email,
      date,
      time,
      details: 'Admin closed the task'
    })
  });
  
  document.getElementById('viewTaskModal').classList.add('hidden');
}

window.reassignTask = async function(taskId) {
  const task = tasksCache.find(t => t.id === taskId);
  
  if (task.status === 'rejected') {
    alert('Cannot reassign a rejected task! Please create a new task from it instead.');
    return;
  }
  
  const newPrimary = document.getElementById('reassignPrimary').value;
  const newSecondary = document.getElementById('reassignSecondary').value;
  
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  
  const updates = {
    trail: firebase.firestore.FieldValue.arrayUnion({
      action: 'Task Reassigned',
      user: currentUser.email,
      date,
      time,
      details: `Task reassigned`
    })
  };
  
  if (newPrimary && newPrimary !== task.primaryUser) {
    updates.primaryUser = newPrimary;
    updates.assignmentHistory = firebase.firestore.FieldValue.arrayUnion({
      previousAssignee: task.primaryUser,
      newAssignee: newPrimary,
      date,
      time
    });
  }
  
  if (newSecondary !== task.secondaryUser) {
    updates.secondaryUser = newSecondary || null;
  }
  
  await db.collection('groups').doc(currentGroup).collection('tasks').doc(taskId).update(updates);
  
  document.getElementById('viewTaskModal').classList.add('hidden');
}

window.openCreateTaskFromTask = async function(taskId) {
  const task = tasksCache.find(t => t.id === taskId);
  if (!task) return;
  
  // Close view task modal
  document.getElementById('viewTaskModal').classList.add('hidden');
  
  // Generate new task ID
  const newTaskId = `${task.taskId} (Revised)`;
  
  // Open task modal and prefill
  document.getElementById('taskModalTitle').textContent = 'Create New Task from Task';
  
  // Prefill form
  document.getElementById('taskId').value = newTaskId;
  document.getElementById('taskDescription').value = task.description;
  document.getElementById('taskPrimary').value = task.primaryUser;
  document.getElementById('taskSecondary').value = task.secondaryUser || '';
  document.getElementById('taskCategory').value = task.categoryId || '';
  document.getElementById('taskProject').value = task.projectId || '';
  document.getElementById('taskPriority').value = task.priority || '';
  document.getElementById('taskDuration').value = task.duration;
  document.getElementById('taskRemarks').value = task.remarks || '';
  
  // Show task modal
  document.getElementById('taskModal').classList.remove('hidden');
}

function openInviteUserModal() {
  document.getElementById('inviteUserForm').reset();
  document.getElementById('inviteUserModal').classList.remove('hidden');
}

async function handleInviteUser(e) {
  e.preventDefault();
  const email = document.getElementById('inviteEmail').value.trim();
  const name = document.getElementById('inviteName').value.trim();
  const position = document.getElementById('invitePosition').value.trim();
  
  try {
    await db.collection('groups').doc(currentGroup).collection('users').doc(email).set({
      email,
      name,
      position,
      isAdmin: false,
      invitedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    document.getElementById('inviteUserModal').classList.add('hidden');
    alert('User invited successfully!');
  } catch (error) {
    console.error('Invite user error:', error);
    alert('Failed to invite user: ' + error.message);
  }
}

function loadUsersList() {
  // Filter admins and non-admins
  const admins = usersCache.filter(u => u.isAdmin);
  const teamMembers = usersCache.filter(u => !u.isAdmin && u.status !== 'inactive' && u.status !== 'suspended'); // Eligible users
  
  // Render admins
  document.getElementById('adminsList').innerHTML = admins.map(user => `
    <div class="user-card">
      <div class="user-info">
        <h4>${user.name}</h4>
        <p>${user.email}</p>
        <p>${user.position}</p>
      </div>
    </div>
  `).join('');
  
  // Render team members
  document.getElementById('invitedUsersList').innerHTML = teamMembers.map(user => `
    <div class="user-card">
      <div class="user-info">
        <h4>${user.name}</h4>
        <p>${user.email}</p>
        <p>${user.position}</p>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn secondary-btn small-btn transfer-admin-btn" data-email="${user.email}">Transfer Admin Role</button>
        <button class="btn secondary-btn small-btn remove-user-btn" data-email="${user.email}">Remove</button>
      </div>
    </div>
  `).join('');
  
  // Add remove button listeners
  document.querySelectorAll('.remove-user-btn').forEach(btn => {
    btn.addEventListener('click', () => removeUser(btn.dataset.email));
  });
  
  // Add transfer admin button listeners
  document.querySelectorAll('.transfer-admin-btn').forEach(btn => {
    btn.addEventListener('click', () => openTransferAdminModal(btn.dataset.email));
  });
}

async function removeUser(email) {
  if (!confirm('Are you sure you want to remove this user?')) return;
  
  try {
    await db.collection('groups').doc(currentGroup).collection('users').doc(email).delete();
    alert('User removed successfully');
  } catch (error) {
    console.error('Remove user error:', error);
    alert('Failed to remove user: ' + error.message);
  }
}

function openTransferAdminModal(selectedEmail) {
  // Populate the select with eligible users
  const eligibleUsers = usersCache.filter(u => !u.isAdmin && u.status !== 'inactive' && u.status !== 'suspended');
  const selectEl = document.getElementById('transferAdminUser');
  selectEl.innerHTML = '<option value="">Select a user</option>' + 
    eligibleUsers.map(u => `<option value="${u.email}" ${u.email === selectedEmail ? 'selected' : ''}>${u.name} (${u.email})</option>`).join('');
  
  document.getElementById('transferAdminModal').classList.remove('hidden');
}

async function confirmTransferAdmin() {
  const newAdminEmail = document.getElementById('transferAdminUser').value;
  if (!newAdminEmail) {
    alert('Please select a user');
    return;
  }
  
  const newAdminUser = usersCache.find(u => u.email === newAdminEmail);
  if (!confirm(`Are you sure you want to transfer Admin privileges to ${newAdminUser.name}? This action will swap roles and transfer all active responsibilities between both users.`)) {
    return;
  }
  
  try {
    const batch = db.batch();
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].substring(0, 5);
    
    // Update current user's role to member
    batch.update(db.collection('groups').doc(currentGroup).collection('users').doc(currentUser.email), {
      isAdmin: false
    });
    
    // Update new admin's role to admin
    batch.update(db.collection('groups').doc(currentGroup).collection('users').doc(newAdminEmail), {
      isAdmin: true
    });
    
    // Reassign active tasks: swap primary and secondary users between current admin and new admin
    // Active tasks are those NOT in closed, completed, rejected
    tasksCache.forEach(task => {
      if (['closed', 'completed', 'rejected'].includes(task.status)) return;
      
      const taskRef = db.collection('groups').doc(currentGroup).collection('tasks').doc(task.id);
      let updates = {
        lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdatedBy: currentUser.email
      };
      
      // Check if primary is current admin → swap with new admin
      if (task.primary === currentUser.email) {
        updates.primary = newAdminEmail;
      } else if (task.primary === newAdminEmail) {
        updates.primary = currentUser.email;
      }
      
      // Check if secondary is current admin → swap with new admin
      if (task.secondary === currentUser.email) {
        updates.secondary = newAdminEmail;
      } else if (task.secondary === newAdminEmail) {
        updates.secondary = currentUser.email;
      }
      
      // Add to trail
      updates.trail = firebase.firestore.FieldValue.arrayUnion({
        action: 'Admin Role Transfer',
        user: currentUser.email,
        date: date,
        time: time,
        details: `Responsibilities transferred between ${currentUserData.name} and ${newAdminUser.name}`
      });
      
      batch.update(taskRef, updates);
    });
    
    // Add audit log entry (we'll use the group's audit trail or create an audit log)
    // For now, let's add to the group document
    batch.update(db.collection('groups').doc(currentGroup), {
      auditTrail: firebase.firestore.FieldValue.arrayUnion({
        action: 'Admin Role Transfer',
        oldAdmin: currentUserData.name,
        oldAdminEmail: currentUser.email,
        newAdmin: newAdminUser.name,
        newAdminEmail: newAdminEmail,
        date: date,
        time: time
      })
    });
    
    await batch.commit();
    
    // Create notifications
    // New admin notification
    await db.collection('groups').doc(currentGroup).collection('users').doc(newAdminEmail).collection('notifications').add({
      type: 'admin_role_transfer',
      message: 'You are now the Group Admin.',
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Former admin notification
    await db.collection('groups').doc(currentGroup).collection('users').doc(currentUser.email).collection('notifications').add({
      type: 'admin_role_transfer',
      message: 'You are now a Group Member.',
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Notify all group members
    for (const user of usersCache) {
      if (user.email !== currentUser.email && user.email !== newAdminEmail) {
        await db.collection('groups').doc(currentGroup).collection('users').doc(user.email).collection('notifications').add({
          type: 'admin_role_transfer',
          message: `Admin role has been transferred from ${currentUserData.name} to ${newAdminUser.name}.`,
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }
    
    // Close modal
    document.getElementById('transferAdminModal').classList.add('hidden');
    
    alert('Admin role successfully transferred. Roles and active responsibilities have been interchanged. You will be logged out.');
    
    // Auto logout
    handleLogout();
    
  } catch (error) {
    console.error('Transfer admin error:', error);
    alert('Failed to transfer admin role: ' + error.message);
  }
}

function populateCategoryProjectFilters() {
  // Populate task form selects
  const categorySelect = document.getElementById('taskCategory');
  const projectSelect = document.getElementById('taskProject');
  const categoryFilter = document.getElementById('taskCategoryFilter');
  const projectFilter = document.getElementById('taskProjectFilter');
  
  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">Select Project Category</option>' +
      categoriesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
  
  if (projectSelect) {
    projectSelect.innerHTML = '<option value="">Select Project Name</option>' +
      projectsCache.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }
  
  if (categoryFilter) {
    categoryFilter.innerHTML = '<option value="">All Categories</option>' +
      categoriesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
  
  if (projectFilter) {
    projectFilter.innerHTML = '<option value="">All Projects</option>' +
      projectsCache.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }
}

function renderCategoriesList() {
  const categoriesList = document.getElementById('categoriesList');
  if (!categoriesList) return;
  
  if (categoriesCache.length === 0) {
    categoriesList.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 2rem;">No categories yet. Create one to get started!</p>';
    return;
  }
  
  categoriesList.innerHTML = categoriesCache.map(category => `
    <div class="user-card">
      <div class="user-info">
        <h4>${category.name}</h4>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn secondary-btn small-btn edit-category-btn" data-id="${category.id}">Edit</button>
        <button class="btn secondary-btn small-btn delete-category-btn" data-id="${category.id}" style="background: var(--danger-100); color: var(--danger-600); border: none;">Delete</button>
      </div>
    </div>
  `).join('');
  
  // Add listeners
  document.querySelectorAll('.edit-category-btn').forEach(btn => {
    btn.addEventListener('click', () => editCategory(btn.dataset.id));
  });
  document.querySelectorAll('.delete-category-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteCategory(btn.dataset.id));
  });
}

function renderProjectsList() {
  const projectsList = document.getElementById('projectsList');
  if (!projectsList) return;
  
  if (projectsCache.length === 0) {
    projectsList.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 2rem;">No projects yet. Create one to get started!</p>';
    return;
  }
  
  projectsList.innerHTML = projectsCache.map(project => `
    <div class="user-card">
      <div class="user-info">
        <h4>${project.name}</h4>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn secondary-btn small-btn edit-project-btn" data-id="${project.id}">Edit</button>
        <button class="btn secondary-btn small-btn delete-project-btn" data-id="${project.id}" style="background: var(--danger-100); color: var(--danger-600); border: none;">Delete</button>
      </div>
    </div>
  `).join('');
  
  // Add listeners
  document.querySelectorAll('.edit-project-btn').forEach(btn => {
    btn.addEventListener('click', () => editProject(btn.dataset.id));
  });
  document.querySelectorAll('.delete-project-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteProject(btn.dataset.id));
  });
}

function updateCounts() {
  const totalCategoriesEl = document.getElementById('totalCategoriesCount');
  const totalProjectsEl = document.getElementById('totalProjectsCount');
  if (totalCategoriesEl) totalCategoriesEl.textContent = categoriesCache.length;
  if (totalProjectsEl) totalProjectsEl.textContent = projectsCache.length;
}

function openCategoryModal(categoryId = null) {
  const modal = document.getElementById('categoryModal');
  const title = document.getElementById('categoryModalTitle');
  const form = document.getElementById('categoryForm');
  const idInput = document.getElementById('categoryId');
  const nameInput = document.getElementById('categoryName');
  
  if (!modal) return;
  
  form.reset();
  idInput.value = '';
  
  if (categoryId) {
    const category = categoriesCache.find(c => c.id === categoryId);
    if (category) {
      title.textContent = 'Edit Project Category';
      idInput.value = category.id;
      nameInput.value = category.name;
    }
  } else {
    title.textContent = 'Create New Category';
  }
  
  modal.classList.remove('hidden');
}

function openProjectModal(projectId = null) {
  const modal = document.getElementById('projectModal');
  const title = document.getElementById('projectModalTitle');
  const form = document.getElementById('projectForm');
  const idInput = document.getElementById('projectId');
  const nameInput = document.getElementById('projectName');
  
  if (!modal) return;
  
  form.reset();
  idInput.value = '';
  
  if (projectId) {
    const project = projectsCache.find(p => p.id === projectId);
    if (project) {
      title.textContent = 'Edit Project Name';
      idInput.value = project.id;
      nameInput.value = project.name;
    }
  } else {
    title.textContent = 'Create New Project';
  }
  
  modal.classList.remove('hidden');
}

async function handleSaveCategory(e) {
  e.preventDefault();
  const categoryId = document.getElementById('categoryId').value;
  const name = document.getElementById('categoryName').value.trim();
  
  if (!name) {
    alert('Please enter a category name');
    return;
  }
  
  // Check for case-insensitive duplicates
  const normalizedName = name.toLowerCase();
  const duplicate = categoriesCache.find(c => c.name.toLowerCase() === normalizedName && c.id !== categoryId);
  if (duplicate) {
    alert('A category with this name already exists');
    return;
  }
  
  try {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    
    if (categoryId) {
      // Update
      const oldCategory = categoriesCache.find(c => c.id === categoryId);
      await db.collection('groups').doc(currentGroup).collection('categories').doc(categoryId).update({
        name,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // If name changed, update tasks that use this category
      if (oldCategory && oldCategory.name !== name) {
        const tasksSnapshot = await db.collection('groups').doc(currentGroup).collection('tasks')
          .where('categoryId', '==', categoryId).get();
        
        const batch = db.batch();
        tasksSnapshot.docs.forEach(doc => {
          batch.update(doc.ref, { categoryName: name });
        });
        await batch.commit();
        
        // Send notifications to assigned users
        await notifyAffectedUsers('category', categoryId, oldCategory.name, name);
      }
      
    } else {
      // Create
      await db.collection('groups').doc(currentGroup).collection('categories').add({
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    document.getElementById('categoryModal').classList.add('hidden');
    alert('Category saved successfully');
  } catch (error) {
    console.error('Save category error:', error);
    alert('Failed to save category: ' + error.message);
  }
}

async function handleSaveProject(e) {
  e.preventDefault();
  const projectId = document.getElementById('projectId').value;
  const name = document.getElementById('projectName').value.trim();
  
  if (!name) {
    alert('Please enter a project name');
    return;
  }
  
  // Check for case-insensitive duplicates
  const normalizedName = name.toLowerCase();
  const duplicate = projectsCache.find(p => p.name.toLowerCase() === normalizedName && p.id !== projectId);
  if (duplicate) {
    alert('A project with this name already exists');
    return;
  }
  
  try {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    
    if (projectId) {
      // Update
      const oldProject = projectsCache.find(p => p.id === projectId);
      await db.collection('groups').doc(currentGroup).collection('projects').doc(projectId).update({
        name,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // If name changed, update tasks that use this project
      if (oldProject && oldProject.name !== name) {
        const tasksSnapshot = await db.collection('groups').doc(currentGroup).collection('tasks')
          .where('projectId', '==', projectId).get();
        
        const batch = db.batch();
        tasksSnapshot.docs.forEach(doc => {
          batch.update(doc.ref, { projectName: name });
        });
        await batch.commit();
        
        // Send notifications to assigned users
        await notifyAffectedUsers('project', projectId, oldProject.name, name);
      }
      
    } else {
      // Create
      await db.collection('groups').doc(currentGroup).collection('projects').add({
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    document.getElementById('projectModal').classList.add('hidden');
    alert('Project saved successfully');
  } catch (error) {
    console.error('Save project error:', error);
    alert('Failed to save project: ' + error.message);
  }
}

function editCategory(id) {
  openCategoryModal(id);
}

async function deleteCategory(id) {
  if (!confirm('Are you sure you want to delete this category? This will not delete any tasks.')) {
    return;
  }
  
  try {
    const category = categoriesCache.find(c => c.id === id);
    await db.collection('groups').doc(currentGroup).collection('categories').doc(id).delete();
    
    // Send notifications to assigned users
    await notifyAffectedUsers('category', id, category?.name, null);
    
    alert('Category deleted successfully');
  } catch (error) {
    console.error('Delete category error:', error);
    alert('Failed to delete category: ' + error.message);
  }
}

function editProject(id) {
  openProjectModal(id);
}

async function deleteProject(id) {
  if (!confirm('Are you sure you want to delete this project? This will not delete any tasks.')) {
    return;
  }
  
  try {
    const project = projectsCache.find(p => p.id === id);
    await db.collection('groups').doc(currentGroup).collection('projects').doc(id).delete();
    
    // Send notifications to assigned users
    await notifyAffectedUsers('project', id, project?.name, null);
    
    alert('Project deleted successfully');
  } catch (error) {
    console.error('Delete project error:', error);
    alert('Failed to delete project: ' + error.message);
  }
}

async function notifyAffectedUsers(type, id, oldName, newName) {
  // Find tasks that use this category or project
  const fieldName = type === 'category' ? 'categoryId' : 'projectId';
  const tasksSnapshot = await db.collection('groups').doc(currentGroup).collection('tasks')
    .where(fieldName, '==', id).get();
  
  if (tasksSnapshot.empty) return;
  
  // Collect unique users from affected tasks
  const userEmails = new Set();
  tasksSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.primaryUser) userEmails.add(data.primaryUser);
    if (data.secondaryUser) userEmails.add(data.secondaryUser);
  });
  
  // Create notification message
  let message = '';
  if (newName) {
    message = `${type === 'category' ? 'Category' : 'Project'} "${oldName}" has been renamed to "${newName}"`;
  } else {
    message = `${type === 'category' ? 'Category' : 'Project'} "${oldName}" has been deleted`;
  }
  
  // Send notifications to users
  await Promise.all([...userEmails].map(email => {
    return db.collection('groups').doc(currentGroup)
      .collection('users').doc(email)
      .collection('notifications').add({
        type: type + '_updated',
        message,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  }));
}

function openIssueModal() {
  document.getElementById('issueForm').reset();
  document.getElementById('issueModal').classList.remove('hidden');
}

async function handleSubmitIssue(e) {
  e.preventDefault();
  const description = document.getElementById('issueDescription').value.trim();
  const obtainedFrom = document.getElementById('issueObtainedFrom').value.trim();
  const mitigation = document.getElementById('issueMitigation').value.trim();
  const remarks = document.getElementById('issueRemarks').value.trim();
  
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  
  try {
    const issueRef = await db.collection('groups').doc(currentGroup).collection('issues').add({
      description,
      obtainedFrom,
      mitigation,
      remarks,
      reportedBy: currentUser.email,
      reportedDate: date,
      status: 'open',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Ensure users are loaded
    let usersToCheck = usersCache;
    if (usersToCheck.length === 0) {
      const usersSnapshot = await db.collection('groups').doc(currentGroup).collection('users').get();
      usersToCheck = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    // Send notifications to all admins in the group
    const reporterName = usersToCheck.find(u => u.email === currentUser.email)?.name || currentUser.email;
    const admins = usersToCheck.filter(u => u.isAdmin);
    for (const admin of admins) {
      // Don't send notification to the reporter if they are an admin
      if (admin.email === currentUser.email) continue;
      
      await db.collection('groups').doc(currentGroup)
        .collection('users').doc(admin.email)
        .collection('notifications').add({
          type: 'issue_reported',
          issueId: issueRef.id,
          message: `New issue reported by ${reporterName}: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`,
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    document.getElementById('issueModal').classList.add('hidden');
    alert('Issue reported successfully!');
  } catch (error) {
    console.error('Submit issue error:', error);
    alert('Failed to report issue: ' + error.message);
  }
}

function loadIssues() {
  let issues = [...issuesCache];
  const isAdmin = currentUserData?.isAdmin;

  if (!isAdmin) {
    issues = issues.filter(i => i.reportedBy === currentUser.email);
  }

  // Apply search and filter
  const searchTerm = document.getElementById('issueSearch').value.toLowerCase();
  const statusFilter = document.getElementById('issueStatusFilter').value;
  const reportedByFilter = document.getElementById('issueReportedByFilter').value;
  const dateFilter = document.getElementById('issueDateFilter').value;

  if (searchTerm) {
    issues = issues.filter(i => 
      i.description.toLowerCase().includes(searchTerm) || 
      (i.obtainedFrom && i.obtainedFrom.toLowerCase().includes(searchTerm)) ||
      (i.remarks && i.remarks.toLowerCase().includes(searchTerm))
    );
  }

  if (statusFilter) {
    issues = issues.filter(i => i.status === statusFilter);
  }

  if (reportedByFilter) {
    issues = issues.filter(i => i.reportedBy === reportedByFilter);
  }

  if (dateFilter) {
    issues = issues.filter(i => i.reportedDate === dateFilter);
  }

  document.getElementById('issuesList').innerHTML = issues.map(issue => {
    const reporter = usersCache.find(u => u.email === issue.reportedBy);
    return `
      <div class="issue-card">
        <div class="task-header">
          <h4 style="margin:0;">Issue Report</h4>
          <span class="task-status ${issue.status === 'open' ? 'status-pending' : 'status-completed'}">${issue.status}</span>
        </div>
        <p style="margin-bottom: 0.75rem; font-size:0.9375rem;">${issue.description}</p>
        <div class="task-meta">
          <span><strong>Reported by:</strong> ${reporter?.name || issue.reportedBy}</span>
          <span><strong>Date:</strong> ${issue.reportedDate}</span>
          <span><strong>Obtained from:</strong> ${issue.obtainedFrom}</span>
        </div>
        ${issue.mitigation ? `<p style="margin-top: 0.75rem;"><strong>Suggested Mitigation:</strong> ${issue.mitigation}</p>` : ''}
        ${issue.remarks ? `<p style="margin-top: 0.5rem;"><strong>Remarks:</strong> ${issue.remarks}</p>` : ''}
        ${isAdmin && issue.status === 'open' ? `
          <div class="issue-actions">
            <button class="btn primary-btn small-btn create-task-from-issue" data-issue-id="${issue.id}">Create Task from Issue</button>
          </div>
        ` : ''}
        ${isAdmin ? `
          <div class="issue-actions" style="margin-top: 0.5rem;">
            <button class="btn secondary-btn small-btn delete-issue-btn" data-issue-id="${issue.id}" style="background: var(--danger-100); color: var(--danger-600); border: none;">Delete Issue</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Add event listeners for "Create Task from Issue" buttons
  document.querySelectorAll('.create-task-from-issue').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const issueId = e.target.dataset.issueId;
      const issue = issuesCache.find(i => i.id === issueId);
      openTaskModal({ id: issueId, ...issue });
    });
  });

  // Add event listeners for "Delete Issue" buttons
  document.querySelectorAll('.delete-issue-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const issueId = e.target.dataset.issueId;
      deleteIssue(issueId);
    });
  });
}
