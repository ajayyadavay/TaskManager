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

  // User profile dropdown
  document.getElementById('userProfile').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('dropdownMenu').classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    document.getElementById('dropdownMenu').classList.add('hidden');
  });

  // Search and filter events
  ['taskSearch', 'taskStatusFilter', 'taskPrimaryFilter', 'taskSecondaryFilter', 'taskDateFilter', 'taskDeadlineFilter', 'taskRemainingDaysFilter'].forEach(id => {
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
    } else {
      document.getElementById('createTaskBtn').classList.add('hidden');
      document.getElementById('inviteUserBtn').classList.add('hidden');
      document.getElementById('adminNavUsers').classList.add('hidden');
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
  const progress = [...task.progress];
  progress[progress.length - 1].verifiedByPrimary = true;
  
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  
  await db.collection('groups').doc(currentGroup).collection('tasks').doc(taskId).update({
    progress,
    trail: firebase.firestore.FieldValue.arrayUnion({
      action: 'Progress Verified',
      user: currentUser.email,
      date,
      time,
      details: 'Primary user verified progress'
    })
  });
  
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

function handleLogout() {
  auth.signOut();
  localStorage.removeItem('currentGroup');
  currentUser = null;
  currentGroup = null;
  currentGroupData = null;
  usersCache = [];
  currentUserData = null;
  tasksCache = [];
  issuesCache = [];
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
    closed: 0
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
        <div class="task-status ${statusClass}">${task.status.replace('_', ' ')}</div>
      </div>
      <p style="margin-bottom: 1rem;">${task.description}</p>
      <div class="task-meta">
        <span><strong>Primary:</strong> ${primaryUser?.name || task.primaryUser}</span>
        ${secondaryUser ? `<span><strong>Secondary:</strong> ${secondaryUser?.name || task.secondaryUser}</span>` : ''}
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
  
  primarySelect.innerHTML = '<option value="">Select Primary User</option>' +
    usersCache.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('');
  secondarySelect.innerHTML = '<option value="">Select Secondary User (Optional)</option>' +
    usersCache.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('');
  
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
  const duration = parseInt(document.getElementById('taskDuration').value);
  const remarks = document.getElementById('taskRemarks').value.trim();

  const now = new Date();
  const assignedDate = now.toISOString().split('T')[0];
  const assignedTime = now.toTimeString().split(' ')[0].substring(0, 5);
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + duration);
  const deadlineStr = deadline.toISOString().split('T')[0];

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

  let progressHtml = progressToShow.map(p => `
    <div class="progress-update">
      <div class="update-header">
        <strong>${usersCache.find(u => u.email === p.user)?.name || p.user}</strong>
        <span>${p.date} ${p.time}</span>
      </div>
      <p><strong>Status:</strong> ${p.status.replace('_', ' ')}</p>
      <p>${p.description}</p>
    </div>
  `).join('');

  let trailHtml = task.trail.map(t => `
    <div class="trail-item">
      <div><strong>${t.action}</strong> by ${usersCache.find(u => u.email === t.user)?.name || t.user}</div>
      <div class="trail-date">${t.date} ${t.time}</div>
      <div>${t.details}</div>
    </div>
  `).join('');
  
  // Assignment history (only visible to admins)
  let assignmentHistoryHtml = '';
  if (isAdmin && task.assignmentHistory && task.assignmentHistory.length > 0) {
    assignmentHistoryHtml = `
      <div class="trail-list">
        <h4>Assignment History</h4>
        ${task.assignmentHistory.map(h => `
          <div class="trail-item">
            <div><strong>Task Reassigned</strong> from ${usersCache.find(u => u.email === h.previousAssignee)?.name || h.previousAssignee} to ${usersCache.find(u => u.email === h.newAssignee)?.name || h.newAssignee}</div>
            <div class="trail-date">${h.date} ${h.time}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  let actionsHtml = '';
  if (task.status === 'pending' && isPrimary) {
    actionsHtml = `
      <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem;">
        <button class="btn primary-btn" style="flex:1;" onclick="acceptTask('${task.id}')">Accept Task</button>
        <button class="btn secondary-btn" style="flex:1;" onclick="rejectTask('${task.id}')">Reject Task</button>
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
          <button class="btn primary-btn" style="width:100%;" onclick="verifyProgress('${task.id}')">Verify Latest Progress</button>
        </div>
      `;
    }
  }
  
  // Admin actions: close task, delete task
  if (isAdmin) {
    if (!isTaskFinished(task)) {
      actionsHtml = (actionsHtml || '') + `
        <div style="margin-top: 1.5rem; border-top: 1px solid var(--gray-200); padding-top: 1.5rem;">
          <h4 style="margin-bottom: 1rem;">Extend Deadline</h4>
          <div class="input-group">
            <label for="extendDeadlineDays">Add More Days</label>
            <input type="number" id="extendDeadlineDays" min="1" value="1" placeholder="Enter number of days">
          </div>
          <button class="btn primary-btn" style="width:100%;" onclick="extendTaskDeadline('${task.id}')">Extend Deadline</button>
        </div>
      `;
    }

    if (task.status === 'completed') {
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
    // Admin reassignment
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

  const content = document.getElementById('viewTaskContent');
  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
      <h2 style="color: var(--primary); margin:0;">${task.taskId}</h2>
      <span class="task-status status-${task.status.replace('_', '-')}">${task.status.replace('_', ' ')}</span>
    </div>
    <p style="margin-bottom: 1.25rem; font-size: 1rem; line-height: 1.6;">${task.description}</p>
    <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.25rem;">
      <div><strong>Primary User:</strong> ${primaryUser?.name || task.primaryUser}</div>
      <div><strong>Secondary User:</strong> ${secondaryUser?.name || 'Not assigned'}</div>
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

window.acceptTask = async function(taskId) {
  const task = tasksCache.find(t => t.id === taskId);
  const taskDisplayId = task?.taskId || taskId;
  
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  
  await db.collection('groups').doc(currentGroup).collection('tasks').doc(taskId).update({
    status: 'accepted',
    trail: firebase.firestore.FieldValue.arrayUnion({
      action: 'Task Accepted',
      user: currentUser.email,
      date,
      time,
      details: 'User accepted the task'
    })
  });
  
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
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  
  await db.collection('groups').doc(currentGroup).collection('tasks').doc(taskId).update({
    status: 'rejected',
    trail: firebase.firestore.FieldValue.arrayUnion({
      action: 'Task Rejected',
      user: currentUser.email,
      date,
      time,
      details: 'User rejected the task'
    })
  });
  
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

  if (Number.isNaN(extraDays) || extraDays < 1) {
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
  const newPrimary = document.getElementById('reassignPrimary').value;
  const newSecondary = document.getElementById('reassignSecondary').value;
  
  const task = tasksCache.find(t => t.id === taskId);
  
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
  const teamMembers = usersCache.filter(u => !u.isAdmin);
  
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
      <div>
        <button class="btn secondary-btn small-btn remove-user-btn" data-email="${user.email}">Remove</button>
      </div>
    </div>
  `).join('');
  
  // Add remove button listeners
  document.querySelectorAll('.remove-user-btn').forEach(btn => {
    btn.addEventListener('click', () => removeUser(btn.dataset.email));
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
