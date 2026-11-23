/**
 * CV / Curriculum Vitae Module for Taskay
 * Supports multi-template CV creation, real-time A4 live preview,
 * section reordering & hiding, import/export (*.cv, PDF, MS Word),
 * and Firestore syncing with app visibility rules.
 */

(function () {
  'use strict';

  // Global CV State
  window.cvsCache = window.cvsCache || [];
  let currentCv = null;
  let cvZoomLevel = 0.85; // Initial preview zoom for good viewport fit
  let activeTabSection = 'list'; // 'list' or 'editor'

  // Default Section List
  const DEFAULT_SECTIONS_ORDER = [
    'personal',
    'summary',
    'experience',
    'education',
    'skills',
    'certifications',
    'publications',
    'awards',
    'projects',
    'memberships',
    'languages',
    'references'
  ];

  const SECTION_TITLES = {
    personal: 'Personal Information',
    summary: 'Professional Summary',
    experience: 'Work Experience',
    education: 'Education',
    skills: 'Technical Skills',
    certifications: 'Certifications and Training',
    publications: 'Research and Publications',
    awards: 'Scholarships and Awards',
    projects: 'Projects',
    memberships: 'Professional Memberships',
    languages: 'Languages',
    references: 'References'
  };

  const SECTION_ICONS = {
    personal: 'fa-id-card',
    summary: 'fa-align-left',
    experience: 'fa-briefcase',
    education: 'fa-graduation-cap',
    skills: 'fa-code',
    certifications: 'fa-certificate',
    publications: 'fa-book-open',
    awards: 'fa-trophy',
    projects: 'fa-diagram-project',
    memberships: 'fa-users-rectangle',
    languages: 'fa-language',
    references: 'fa-user-check'
  };

  // Sample data generator for new CVs
  function createDefaultCvData(title = 'Professional CV') {
    const userEmail = window.currentUser ? window.currentUser.email : '';
    const userName = window.currentUser && window.currentUser.displayName ? window.currentUser.displayName : 'Alex Morgan';

    return {
      id: 'cv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: title,
      visibility: 'private', // 'private' or 'public'
      template: 'modern', // 'modern', 'classic', 'minimal', 'ats'
      createdBy: userEmail,
      createdByName: userName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sectionsOrder: [...DEFAULT_SECTIONS_ORDER],
      hiddenSections: [],

      personal: {
        fullName: userName,
        jobTitle: 'Senior Project Lead & Full-Stack Architect',
        email: userEmail || 'alex.morgan@example.com',
        phone: '+1 (555) 345-6789',
        location: 'San Francisco, CA',
        linkedin: 'linkedin.com/in/alexmorgan',
        website: 'alexmorgan.dev',
        github: 'github.com/alexmorgan'
      },

      summary: 'Results-driven technology leader and systems architect with over 8 years of proven experience orchestrating cross-functional engineering teams, architecting fault-tolerant distributed platforms, and delivering enterprise software. Adept at rapid problem decomposition, agile project execution, and stakeholder communication.',

      experience: [
        {
          id: 'exp_' + Math.random().toString(36).substr(2, 6),
          jobTitle: 'Senior Technical Project Manager & Architect',
          organization: 'Apex Solutions International',
          department: 'Core Infrastructure',
          location: 'San Francisco, CA',
          startDate: '2022-04',
          endDate: '',
          current: true,
          employmentType: 'Full-time',
          responsibilities: [
            'Spearheaded the migration of legacy monolithic services to an event-driven microservices architecture, cutting end-to-end task turnaround by 42%.',
            'Supervised a team of 14 senior engineers, driving sprint cadence, backlog grooming, and quarterly milestone deliverables.',
            'Implemented automated CI/CD security pipelines reducing deployment rollbacks by 70%.'
          ]
        },
        {
          id: 'exp_' + Math.random().toString(36).substr(2, 6),
          jobTitle: 'Software Engineer II',
          organization: 'Vanguard Digital Systems',
          department: 'Product Engineering',
          location: 'San Jose, CA',
          startDate: '2019-06',
          endDate: '2022-03',
          current: false,
          employmentType: 'Full-time',
          responsibilities: [
            'Designed and maintained high-throughput REST and GraphQL APIs serving 3M+ active monthly queries.',
            'Collaborated with UX and product teams to implement accessible, responsive user interfaces.'
          ]
        }
      ],

      education: [
        {
          id: 'edu_' + Math.random().toString(36).substr(2, 6),
          degree: 'B.S. in Computer Science & Engineering',
          institution: 'University of California, Berkeley',
          location: 'Berkeley, CA',
          duration: '2015 - 2019',
          grade: 'GPA: 3.86 / 4.0 (Magna Cum Laude)',
          remarks: 'Dean’s Honor List (4 consecutive semesters), Focus on Distributed Computing'
        }
      ],

      skills: [
        {
          id: 'cat_' + Math.random().toString(36).substr(2, 6),
          category: 'Programming & Web',
          items: ['JavaScript (ES6+)', 'TypeScript', 'Python', 'Node.js', 'React', 'HTML5/CSS3']
        },
        {
          id: 'cat_' + Math.random().toString(36).substr(2, 6),
          category: 'Cloud & Infrastructure',
          items: ['AWS', 'Firebase Firestore', 'Docker', 'Kubernetes', 'CI/CD Pipelines', 'Linux']
        },
        {
          id: 'cat_' + Math.random().toString(36).substr(2, 6),
          category: 'Project Management & Collaboration',
          items: ['Agile / Scrum', 'JIRA', 'System Architecture', 'Sprint Planning', 'Risk Mitigation']
        }
      ],

      certifications: [
        {
          id: 'cert_' + Math.random().toString(36).substr(2, 6),
          name: 'AWS Certified Solutions Architect – Professional',
          organization: 'Amazon Web Services',
          issueDate: '2023-08',
          expirationDate: '2026-08',
          credentialId: 'AWS-SAP-894102',
          url: 'https://aws.amazon.com/verify'
        },
        {
          id: 'cert_' + Math.random().toString(36).substr(2, 6),
          name: 'Project Management Professional (PMP)',
          organization: 'Project Management Institute (PMI)',
          issueDate: '2022-02',
          expirationDate: '2025-02',
          credentialId: 'PMI-PMP-2049182',
          url: 'https://pmi.org/verify'
        }
      ],

      publications: [
        {
          id: 'pub_' + Math.random().toString(36).substr(2, 6),
          title: 'Resilient Consensus Scheduling in Cloud-Native Distributed Microservices',
          publisher: 'IEEE International Conference on Cloud Engineering (IC2E)',
          date: '2023-11',
          authors: 'A. Morgan, D. Chen, K. Patel',
          url: 'https://doi.org/10.1109/IC2E.2023.0019',
          abstract: 'Evaluated latency profiles of distributed consensus models under network partitions, demonstrating a 28% tail-latency reduction.'
        }
      ],

      awards: [
        {
          id: 'award_' + Math.random().toString(36).substr(2, 6),
          title: 'Outstanding Technical Leadership Award',
          issuer: 'Apex Solutions Annual Excellence Forum',
          date: '2023-12',
          description: 'Awarded for exceptional leadership in enterprise digital transformation and cross-functional team delivery.'
        }
      ],

      projects: [
        {
          id: 'proj_' + Math.random().toString(36).substr(2, 6),
          name: 'Taskay Collaborative Operations Suite',
          role: 'Lead Architect',
          technologies: 'Firebase, JavaScript, REST, html2pdf',
          link: 'https://github.com/apex/taskay-suite',
          duration: '2023 - 2024',
          highlights: [
            'Architected multi-group real-time data sync with granular role-based access control and live audit trails.',
            'Integrated client-side document compilers supporting instant PDF and Word exports.'
          ]
        }
      ],

      memberships: [
        {
          id: 'mem_' + Math.random().toString(36).substr(2, 6),
          organization: 'Institute of Electrical and Electronics Engineers (IEEE)',
          role: 'Senior Member',
          period: '2020 - Present'
        },
        {
          id: 'mem_' + Math.random().toString(36).substr(2, 6),
          organization: 'Association for Computing Machinery (ACM)',
          role: 'Professional Member',
          period: '2019 - Present'
        }
      ],

      languages: [
        {
          id: 'lang_' + Math.random().toString(36).substr(2, 6),
          language: 'English',
          proficiency: 'Native / Bilingual'
        },
        {
          id: 'lang_' + Math.random().toString(36).substr(2, 6),
          language: 'Spanish',
          proficiency: 'Professional Working'
        }
      ],

      references: {
        availableUponRequest: false,
        items: [
          {
            id: 'ref_' + Math.random().toString(36).substr(2, 6),
            name: 'Dr. Evelyn Carter',
            designation: 'VP of Engineering',
            organization: 'Apex Solutions International',
            email: 'e.carter@apexsolutions.com',
            phone: '+1 (555) 901-2345',
            relationship: 'Direct Supervisor'
          }
        ]
      }
    };
  }

  // ==========================================================================
  // Storage & Sync Helpers
  // ==========================================================================
  function getLocalStorageKey() {
    const grp = window.currentGroup || 'default';
    return `taskay_cvs_${grp}`;
  }

  function getLocalCVs() {
    try {
      const data = localStorage.getItem(getLocalStorageKey());
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Error reading local CVs:', e);
      return [];
    }
  }

  function saveLocalCVs(cvs) {
    try {
      localStorage.setItem(getLocalStorageKey(), JSON.stringify(cvs));
    } catch (e) {
      console.warn('Error saving local CVs:', e);
    }
  }

  // Save CV to Firestore and Local Storage
  async function saveCvToStorage(cvData) {
    cvData.updatedAt = new Date().toISOString();

    // Update memory cache
    const existingIdx = window.cvsCache.findIndex(c => c.id === cvData.id);
    if (existingIdx >= 0) {
      window.cvsCache[existingIdx] = { ...cvData };
    } else {
      window.cvsCache.unshift({ ...cvData });
    }
    saveLocalCVs(window.cvsCache);

    // Save to Firestore if connected
    if (window.db && window.currentGroup) {
      try {
        await window.db.collection('groups').doc(window.currentGroup)
          .collection('cvs').doc(cvData.id).set(cvData);
      } catch (err) {
        console.warn('Could not save CV to Firestore (saved locally):', err);
      }
    }
  }

  async function deleteCvFromStorage(cvId) {
    window.cvsCache = window.cvsCache.filter(c => c.id !== cvId);
    saveLocalCVs(window.cvsCache);

    if (window.db && window.currentGroup) {
      try {
        await window.db.collection('groups').doc(window.currentGroup)
          .collection('cvs').doc(cvId).delete();
      } catch (err) {
        console.warn('Could not delete CV from Firestore (removed locally):', err);
      }
    }
  }

  // ==========================================================================
  // Public Interface: loadCVs (Called by app navigation & listeners)
  // ==========================================================================
  window.loadCVs = function () {
    // If cache is empty, check localStorage
    if (!window.cvsCache || window.cvsCache.length === 0) {
      window.cvsCache = getLocalCVs();
    }
    renderCvListView();
  };

  // Switch between List View and Editor Workspace
  function switchCvSubView(view) {
    activeTabSection = view;
    const listView = document.getElementById('cvListView');
    const editorView = document.getElementById('cvEditorWorkspace');

    if (!listView || !editorView) return;

    if (view === 'editor') {
      listView.classList.add('hidden');
      editorView.classList.remove('hidden');
    } else {
      editorView.classList.add('hidden');
      listView.classList.remove('hidden');
      renderCvListView();
    }
  }

  // ==========================================================================
  // CV List View Rendering & Filtering
  // ==========================================================================
  function renderCvListView() {
    const container = document.getElementById('cvsList');
    if (!container) return;

    const searchTerm = document.getElementById('cvSearch')?.value?.toLowerCase().trim() || '';
    const visibilityFilter = document.getElementById('cvVisibilityFilter')?.value || '';
    const templateFilter = document.getElementById('cvTemplateFilter')?.value || '';

    const currentUserEmail = window.currentUser ? window.currentUser.email : '';
    const isAdmin = window.currentUserData && window.currentUserData.isAdmin;

    // Apply app visibility rule:
    // User can see public CVs or CVs they created
    let visible = (window.cvsCache || []).filter(cv => {
      return cv.visibility === 'public' || cv.createdBy === currentUserEmail;
    });

    // Apply UI filters
    if (visibilityFilter) {
      visible = visible.filter(cv => cv.visibility === visibilityFilter);
    }
    if (templateFilter) {
      visible = visible.filter(cv => (cv.template || 'modern') === templateFilter);
    }
    if (searchTerm) {
      visible = visible.filter(cv => {
        const title = (cv.title || '').toLowerCase();
        const name = (cv.personal?.fullName || '').toLowerCase();
        const role = (cv.personal?.jobTitle || '').toLowerCase();
        return title.includes(searchTerm) || name.includes(searchTerm) || role.includes(searchTerm);
      });
    }

    if (visible.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--gray-500);">
          <i class="fas fa-file-invoice" style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--gray-400);"></i>
          <h3 style="font-size: 1.1rem; color: var(--gray-700); margin-bottom: 0.5rem;">No CVs Found</h3>
          <p style="font-size: 0.9rem; margin-bottom: 1.25rem;">Create your first professional CV or import an existing *.cv file.</p>
          <button class="btn primary-btn" onclick="window.createNewCvPrompt()">
            <i class="fas fa-plus"></i> Create New CV
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = visible.map(cv => {
      const isOwner = cv.createdBy === currentUserEmail || isAdmin;
      const updatedDate = cv.updatedAt ? new Date(cv.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recently';
      const templateName = {
        modern: 'Modern Professional',
        classic: 'Classic Academic',
        minimal: 'Two-Column Minimalist',
        ats: 'Clean and Executive'
      }[cv.template || 'modern'] || 'Modern Professional';

      return `
        <div class="cv-card">
          <div>
            <div class="cv-card-header">
              <div>
                <h3 class="cv-card-title">${escapeHtml(cv.title || 'Untitled CV')}</h3>
                <div class="cv-card-subtitle">${escapeHtml(cv.personal?.fullName || 'Anonymous')} &bull; ${escapeHtml(cv.personal?.jobTitle || 'Professional')}</div>
              </div>
              <div class="cv-card-badges">
                <span class="cv-badge ${cv.visibility}">${cv.visibility}</span>
                <span class="cv-badge template">${templateName}</span>
              </div>
            </div>
            
            <div class="cv-card-meta">
              <div><i class="fas fa-envelope" style="width: 14px; color: var(--gray-400);"></i> ${escapeHtml(cv.personal?.email || 'No email')}</div>
              <div><i class="fas fa-user-pen" style="width: 14px; color: var(--gray-400);"></i> Created by: ${escapeHtml(cv.createdByName || cv.createdBy || 'User')}</div>
              <div><i class="fas fa-clock" style="width: 14px; color: var(--gray-400);"></i> Last modified: ${updatedDate}</div>
            </div>
          </div>

          <div class="cv-card-actions">
            <button class="btn primary-btn" onclick="window.editCvById('${cv.id}')" title="Edit and preview this CV">
              <i class="fas fa-edit"></i> Edit & Preview
            </button>
            <button class="btn secondary-btn" onclick="window.exportCvPdfById('${cv.id}')" title="Export as PDF">
              <i class="fas fa-file-pdf"></i> PDF
            </button>
            <button class="btn secondary-btn" onclick="window.exportCvWordById('${cv.id}')" title="Export as MS Word (.doc)">
              <i class="fas fa-file-word"></i> Word
            </button>
            <button class="btn secondary-btn" onclick="window.downloadCvFileById('${cv.id}')" title="Download *.cv file">
              <i class="fas fa-download"></i> *.cv
            </button>
            ${isOwner ? `
              <button class="btn secondary-btn" style="background: var(--danger-100); color: var(--danger-600); border: none;" onclick="window.deleteCvById('${cv.id}')" title="Delete CV">
                <i class="fas fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================================================
  // CV Editor & Live Preview Workspace
  // ==========================================================================
  window.createNewCvPrompt = function () {
    const title = prompt('Enter a title for your new CV:', 'My Professional CV');
    if (title === null) return;

    currentCv = createDefaultCvData(title.trim() || 'My Professional CV');
    saveCvToStorage(currentCv);
    openCvEditor(currentCv);
  };

  window.editCvById = function (cvId) {
    const cv = window.cvsCache.find(c => c.id === cvId);
    if (!cv) {
      alert('CV not found.');
      return;
    }
    // Deep clone to prevent direct uncommitted mutations
    currentCv = JSON.parse(JSON.stringify(cv));
    openCvEditor(currentCv);
  };

  function openCvEditor(cv) {
    currentCv = cv;
    // Ensure all 12 sections exist in order
    if (!currentCv.sectionsOrder || currentCv.sectionsOrder.length === 0) {
      currentCv.sectionsOrder = [...DEFAULT_SECTIONS_ORDER];
    }
    if (!currentCv.hiddenSections) {
      currentCv.hiddenSections = [];
    }

    // Populate top bar inputs
    const titleInput = document.getElementById('cvDocTitle');
    const visSelect = document.getElementById('cvDocVisibility');
    const tplSelect = document.getElementById('cvDocTemplate');

    if (titleInput) titleInput.value = currentCv.title || 'Untitled CV';
    if (visSelect) visSelect.value = currentCv.visibility || 'private';
    if (tplSelect) tplSelect.value = currentCv.template || 'modern';

    switchCvSubView('editor');
    renderSectionManager();
    renderAllSectionForms();
    updateLivePreview();
  }

  window.backToCvList = function () {
    if (currentCv) {
      saveCvToStorage(currentCv);
    }
    switchCvSubView('list');
  };

  // Save current CV in app
  window.saveCurrentCvInApp = async function () {
    if (!currentCv) return;
    readTopBarValues();
    await saveCvToStorage(currentCv);
    showFloatingNotification('CV saved successfully!');
    renderCvListView();
  };

  function readTopBarValues() {
    if (!currentCv) return;
    const title = document.getElementById('cvDocTitle')?.value?.trim();
    const visibility = document.getElementById('cvDocVisibility')?.value;
    const template = document.getElementById('cvDocTemplate')?.value;

    if (title) currentCv.title = title;
    if (visibility) currentCv.visibility = visibility;
    if (template) currentCv.template = template;
  }

  // ==========================================================================
  // Section Reordering & Hide/Show Manager
  // ==========================================================================
  function renderSectionManager() {
    const chipsContainer = document.getElementById('cvSectionChips');
    if (!chipsContainer || !currentCv) return;

    chipsContainer.innerHTML = currentCv.sectionsOrder.map((secKey, index) => {
      const isHidden = (currentCv.hiddenSections || []).includes(secKey);
      const isFirst = index === 0;
      const isLast = index === currentCv.sectionsOrder.length - 1;
      const title = SECTION_TITLES[secKey] || secKey;

      return `
        <div class="cv-section-chip ${isHidden ? 'is-hidden' : ''}">
          <button class="cv-chip-btn" onclick="window.toggleSectionVisibility('${secKey}')" title="${isHidden ? 'Show Section' : 'Hide Section'}">
            <i class="fas ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
          <span>${title}</span>
          ${!isFirst ? `
            <button class="cv-chip-btn" onclick="window.moveSectionOrder('${secKey}', -1)" title="Move Up">
              <i class="fas fa-chevron-left"></i>
            </button>
          ` : ''}
          ${!isLast ? `
            <button class="cv-chip-btn" onclick="window.moveSectionOrder('${secKey}', 1)" title="Move Down">
              <i class="fas fa-chevron-right"></i>
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  window.toggleSectionVisibility = function (secKey) {
    if (!currentCv) return;
    currentCv.hiddenSections = currentCv.hiddenSections || [];
    const idx = currentCv.hiddenSections.indexOf(secKey);
    if (idx >= 0) {
      currentCv.hiddenSections.splice(idx, 1);
    } else {
      currentCv.hiddenSections.push(secKey);
    }
    renderSectionManager();
    renderAllSectionForms();
    updateLivePreview();
  };

  window.moveSectionOrder = function (secKey, direction) {
    if (!currentCv) return;
    const list = currentCv.sectionsOrder;
    const curIdx = list.indexOf(secKey);
    if (curIdx < 0) return;

    const targetIdx = curIdx + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    // Swap
    const temp = list[curIdx];
    list[curIdx] = list[targetIdx];
    list[targetIdx] = temp;

    renderSectionManager();
    renderAllSectionForms();
    updateLivePreview();
  };

  // ==========================================================================
  // Render Form Editors for All 12 Sections
  // ==========================================================================
  function renderAllSectionForms() {
    const container = document.getElementById('cvSectionFormsContainer');
    if (!container || !currentCv) return;

    container.innerHTML = currentCv.sectionsOrder.map((secKey, index) => {
      const isHidden = (currentCv.hiddenSections || []).includes(secKey);
      const title = SECTION_TITLES[secKey] || secKey;
      const icon = SECTION_ICONS[secKey] || 'fa-folder';
      const isFirst = index === 0;
      const isLast = index === currentCv.sectionsOrder.length - 1;

      let bodyHtml = '';
      switch (secKey) {
        case 'personal':
          bodyHtml = renderPersonalForm(currentCv.personal || {});
          break;
        case 'summary':
          bodyHtml = renderSummaryForm(currentCv.summary || '');
          break;
        case 'experience':
          bodyHtml = renderExperienceForm(currentCv.experience || []);
          break;
        case 'education':
          bodyHtml = renderEducationForm(currentCv.education || []);
          break;
        case 'skills':
          bodyHtml = renderSkillsForm(currentCv.skills || []);
          break;
        case 'certifications':
          bodyHtml = renderCertificationsForm(currentCv.certifications || []);
          break;
        case 'publications':
          bodyHtml = renderPublicationsForm(currentCv.publications || []);
          break;
        case 'awards':
          bodyHtml = renderAwardsForm(currentCv.awards || []);
          break;
        case 'projects':
          bodyHtml = renderProjectsForm(currentCv.projects || []);
          break;
        case 'memberships':
          bodyHtml = renderMembershipsForm(currentCv.memberships || []);
          break;
        case 'languages':
          bodyHtml = renderLanguagesForm(currentCv.languages || []);
          break;
        case 'references':
          bodyHtml = renderReferencesForm(currentCv.references || {});
          break;
      }

      return `
        <div class="cv-section-card ${isHidden ? 'is-hidden-section' : ''}" id="sec_card_${secKey}">
          <div class="cv-section-card-header" onclick="window.toggleSectionCollapse('${secKey}')">
            <div class="cv-section-header-left">
              <i class="fas ${icon}"></i>
              <span>${title}</span>
              ${isHidden ? '<span class="cv-badge" style="background:#fee2e2;color:#dc2626;font-size:0.7rem;">Hidden</span>' : ''}
            </div>
            <div class="cv-section-header-actions" onclick="event.stopPropagation();">
              ${!isFirst ? `
                <button class="cv-chip-btn" onclick="window.moveSectionOrder('${secKey}', -1)" title="Move Section Up">
                  <i class="fas fa-arrow-up"></i>
                </button>
              ` : ''}
              ${!isLast ? `
                <button class="cv-chip-btn" onclick="window.moveSectionOrder('${secKey}', 1)" title="Move Section Down">
                  <i class="fas fa-arrow-down"></i>
                </button>
              ` : ''}
              <button class="cv-chip-btn" onclick="window.toggleSectionVisibility('${secKey}')" title="${isHidden ? 'Show in CV' : 'Hide from CV'}">
                <i class="fas ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
              </button>
              <button class="cv-chip-btn" onclick="window.toggleSectionCollapse('${secKey}')" title="Collapse / Expand">
                <i class="fas fa-chevron-down" id="collapse_icon_${secKey}"></i>
              </button>
            </div>
          </div>
          <div class="cv-section-body" id="sec_body_${secKey}">
            ${bodyHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  window.toggleSectionCollapse = function (secKey) {
    const body = document.getElementById(`sec_body_${secKey}`);
    const icon = document.getElementById(`collapse_icon_${secKey}`);
    if (body) {
      body.classList.toggle('collapsed');
      if (icon) {
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-right');
      }
    }
  };

  // 1. Personal Information Form
  function renderPersonalForm(data) {
    return `
      <div class="cv-form-row">
        <div class="cv-form-group">
          <label>Full Name *</label>
          <input type="text" value="${escapeHtml(data.fullName || '')}" oninput="window.updatePersonalInfo('fullName', this.value)">
        </div>
        <div class="cv-form-group">
          <label>Professional Title / Headline *</label>
          <input type="text" value="${escapeHtml(data.jobTitle || '')}" placeholder="e.g. Senior Software Architect" oninput="window.updatePersonalInfo('jobTitle', this.value)">
        </div>
      </div>
      <div class="cv-form-row">
        <div class="cv-form-group">
          <label>Email *</label>
          <input type="email" value="${escapeHtml(data.email || '')}" oninput="window.updatePersonalInfo('email', this.value)">
        </div>
        <div class="cv-form-group">
          <label>Phone Number *</label>
          <input type="text" value="${escapeHtml(data.phone || '')}" oninput="window.updatePersonalInfo('phone', this.value)">
        </div>
      </div>
      <div class="cv-form-row">
        <div class="cv-form-group">
          <label>Location (City, Country)</label>
          <input type="text" value="${escapeHtml(data.location || '')}" placeholder="e.g. San Francisco, CA" oninput="window.updatePersonalInfo('location', this.value)">
        </div>
        <div class="cv-form-group">
          <label>LinkedIn URL</label>
          <input type="text" value="${escapeHtml(data.linkedin || '')}" placeholder="linkedin.com/in/username" oninput="window.updatePersonalInfo('linkedin', this.value)">
        </div>
      </div>
      <div class="cv-form-row">
        <div class="cv-form-group">
          <label>Personal Website / Portfolio</label>
          <input type="text" value="${escapeHtml(data.website || '')}" placeholder="https://example.com" oninput="window.updatePersonalInfo('website', this.value)">
        </div>
        <div class="cv-form-group">
          <label>GitHub / Profile URL</label>
          <input type="text" value="${escapeHtml(data.github || '')}" placeholder="github.com/username" oninput="window.updatePersonalInfo('github', this.value)">
        </div>
      </div>
    `;
  }

  window.updatePersonalInfo = function (field, value) {
    if (!currentCv) return;
    currentCv.personal = currentCv.personal || {};
    currentCv.personal[field] = value;
    updateLivePreview();
  };

  // 2. Professional Summary Form
  function renderSummaryForm(summaryText) {
    return `
      <div class="cv-form-group">
        <label>Executive / Professional Summary</label>
        <textarea rows="4" placeholder="Highlight your professional identity, years of experience, core expertise, and standout achievements..." oninput="window.updateSummary(this.value)">${escapeHtml(summaryText)}</textarea>
      </div>
    `;
  }

  window.updateSummary = function (text) {
    if (!currentCv) return;
    currentCv.summary = text;
    updateLivePreview();
  };

  // 3. Work Experience Form
  function renderExperienceForm(expList) {
    const listHtml = expList.map((exp, index) => {
      const isFirst = index === 0;
      const isLast = index === expList.length - 1;

      const bulletsHtml = (exp.responsibilities || []).map((bullet, bIdx) => {
        const bFirst = bIdx === 0;
        const bLast = bIdx === (exp.responsibilities.length - 1);
        return `
          <div class="cv-bullet-row">
            <input type="text" value="${escapeHtml(bullet)}" placeholder="Key responsibility / achievement..." oninput="window.updateExpBullet('${exp.id}', ${bIdx}, this.value)">
            ${!bFirst ? `
              <button class="cv-bullet-btn" onclick="window.moveExpBullet('${exp.id}', ${bIdx}, -1)" title="Move Up"><i class="fas fa-arrow-up"></i></button>
            ` : ''}
            ${!bLast ? `
              <button class="cv-bullet-btn" onclick="window.moveExpBullet('${exp.id}', ${bIdx}, 1)" title="Move Down"><i class="fas fa-arrow-down"></i></button>
            ` : ''}
            <button class="cv-bullet-btn delete" onclick="window.deleteExpBullet('${exp.id}', ${bIdx})" title="Delete bullet"><i class="fas fa-trash"></i></button>
          </div>
        `;
      }).join('');

      return `
        <div class="cv-item-box">
          <div class="cv-item-box-header">
            <div class="cv-item-box-title">#${index + 1}: ${escapeHtml(exp.jobTitle || 'New Role')} at ${escapeHtml(exp.organization || 'Organization')}</div>
            <div class="cv-item-box-tools">
              ${!isFirst ? `<button class="cv-chip-btn" onclick="window.moveExpItem(${index}, -1)" title="Move Up"><i class="fas fa-arrow-up"></i></button>` : ''}
              ${!isLast ? `<button class="cv-chip-btn" onclick="window.moveExpItem(${index}, 1)" title="Move Down"><i class="fas fa-arrow-down"></i></button>` : ''}
              <button class="cv-chip-btn" style="color:var(--danger-600);" onclick="window.deleteExpItem('${exp.id}')" title="Delete experience"><i class="fas fa-trash"></i></button>
            </div>
          </div>
          
          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Job Title *</label>
              <input type="text" value="${escapeHtml(exp.jobTitle || '')}" placeholder="e.g. Lead Software Engineer" oninput="window.updateExpField('${exp.id}', 'jobTitle', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Organization / Employer *</label>
              <input type="text" value="${escapeHtml(exp.organization || '')}" placeholder="e.g. Acme Corp" oninput="window.updateExpField('${exp.id}', 'organization', this.value)">
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Department</label>
              <input type="text" value="${escapeHtml(exp.department || '')}" placeholder="e.g. Engineering / Cloud Systems" oninput="window.updateExpField('${exp.id}', 'department', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Location</label>
              <input type="text" value="${escapeHtml(exp.location || '')}" placeholder="e.g. San Francisco, CA" oninput="window.updateExpField('${exp.id}', 'location', this.value)">
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Employment Type</label>
              <select onchange="window.updateExpField('${exp.id}', 'employmentType', this.value)">
                <option value="Full-time" ${exp.employmentType === 'Full-time' ? 'selected' : ''}>Full-time</option>
                <option value="Part-time" ${exp.employmentType === 'Part-time' ? 'selected' : ''}>Part-time</option>
                <option value="Contract" ${exp.employmentType === 'Contract' ? 'selected' : ''}>Contract</option>
                <option value="Freelance" ${exp.employmentType === 'Freelance' ? 'selected' : ''}>Freelance</option>
                <option value="Internship" ${exp.employmentType === 'Internship' ? 'selected' : ''}>Internship</option>
              </select>
            </div>
            <div class="cv-form-group">
              <label>Start Date</label>
              <input type="text" value="${escapeHtml(exp.startDate || '')}" placeholder="e.g. 2021-03 or Mar 2021" oninput="window.updateExpField('${exp.id}', 'startDate', this.value)">
            </div>
            <div class="cv-form-group">
              <label>End Date</label>
              <input type="text" value="${escapeHtml(exp.endDate || '')}" placeholder="e.g. 2024-01" ${exp.current ? 'disabled' : ''} oninput="window.updateExpField('${exp.id}', 'endDate', this.value)">
              <label style="font-size:0.75rem;margin-top:4px;cursor:pointer;">
                <input type="checkbox" ${exp.current ? 'checked' : ''} onchange="window.toggleExpCurrent('${exp.id}', this.checked)"> Currently working here
              </label>
            </div>
          </div>

          <div class="cv-form-group">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem;">
              <label>Responsibilities & Bullet Points</label>
              <button class="btn secondary-btn" style="padding:0.2rem 0.5rem;font-size:0.75rem;" onclick="window.addExpBullet('${exp.id}')">
                <i class="fas fa-plus"></i> Add Bullet
              </button>
            </div>
            <div class="cv-bullets-container">
              ${bulletsHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      ${listHtml}
      <button class="btn secondary-btn" style="width:100%;" onclick="window.addExpItem()">
        <i class="fas fa-plus"></i> + Add Work Experience
      </button>
    `;
  }

  window.addExpItem = function () {
    if (!currentCv) return;
    currentCv.experience = currentCv.experience || [];
    currentCv.experience.push({
      id: 'exp_' + Math.random().toString(36).substr(2, 6),
      jobTitle: '',
      organization: '',
      department: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      employmentType: 'Full-time',
      responsibilities: ['Managed key project deliverables with 100% on-time execution.']
    });
    renderAllSectionForms();
    updateLivePreview();
  };

  window.deleteExpItem = function (id) {
    if (!currentCv) return;
    currentCv.experience = (currentCv.experience || []).filter(e => e.id !== id);
    renderAllSectionForms();
    updateLivePreview();
  };

  window.moveExpItem = function (fromIdx, direction) {
    if (!currentCv) return;
    const list = currentCv.experience;
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= list.length) return;
    const temp = list[fromIdx];
    list[fromIdx] = list[toIdx];
    list[toIdx] = temp;
    renderAllSectionForms();
    updateLivePreview();
  };

  window.updateExpField = function (id, field, value) {
    if (!currentCv) return;
    const item = (currentCv.experience || []).find(e => e.id === id);
    if (item) {
      item[field] = value;
      updateLivePreview();
    }
  };

  window.toggleExpCurrent = function (id, checked) {
    if (!currentCv) return;
    const item = (currentCv.experience || []).find(e => e.id === id);
    if (item) {
      item.current = checked;
      if (checked) item.endDate = 'Present';
      renderAllSectionForms();
      updateLivePreview();
    }
  };

  window.addExpBullet = function (id) {
    if (!currentCv) return;
    const item = (currentCv.experience || []).find(e => e.id === id);
    if (item) {
      item.responsibilities = item.responsibilities || [];
      item.responsibilities.push('');
      renderAllSectionForms();
      updateLivePreview();
    }
  };

  window.updateExpBullet = function (id, bIdx, value) {
    if (!currentCv) return;
    const item = (currentCv.experience || []).find(e => e.id === id);
    if (item && item.responsibilities && item.responsibilities[bIdx] !== undefined) {
      item.responsibilities[bIdx] = value;
      updateLivePreview();
    }
  };

  window.moveExpBullet = function (id, bIdx, direction) {
    if (!currentCv) return;
    const item = (currentCv.experience || []).find(e => e.id === id);
    if (!item || !item.responsibilities) return;
    const targetIdx = bIdx + direction;
    if (targetIdx < 0 || targetIdx >= item.responsibilities.length) return;
    const temp = item.responsibilities[bIdx];
    item.responsibilities[bIdx] = item.responsibilities[targetIdx];
    item.responsibilities[targetIdx] = temp;
    renderAllSectionForms();
    updateLivePreview();
  };

  window.deleteExpBullet = function (id, bIdx) {
    if (!currentCv) return;
    const item = (currentCv.experience || []).find(e => e.id === id);
    if (item && item.responsibilities) {
      item.responsibilities.splice(bIdx, 1);
      renderAllSectionForms();
      updateLivePreview();
    }
  };

  // 4. Education Form
  function renderEducationForm(eduList) {
    const listHtml = eduList.map((edu, index) => {
      const isFirst = index === 0;
      const isLast = index === eduList.length - 1;
      return `
        <div class="cv-item-box">
          <div class="cv-item-box-header">
            <div class="cv-item-box-title">#${index + 1}: ${escapeHtml(edu.degree || 'Degree')} - ${escapeHtml(edu.institution || 'Institution')}</div>
            <div class="cv-item-box-tools">
              ${!isFirst ? `<button class="cv-chip-btn" onclick="window.moveEduItem(${index}, -1)" title="Move Up"><i class="fas fa-arrow-up"></i></button>` : ''}
              ${!isLast ? `<button class="cv-chip-btn" onclick="window.moveEduItem(${index}, 1)" title="Move Down"><i class="fas fa-arrow-down"></i></button>` : ''}
              <button class="cv-chip-btn" style="color:var(--danger-600);" onclick="window.deleteEduItem('${edu.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Degree *</label>
              <input type="text" value="${escapeHtml(edu.degree || '')}" placeholder="e.g. B.S. in Computer Science" oninput="window.updateEduField('${edu.id}', 'degree', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Institution *</label>
              <input type="text" value="${escapeHtml(edu.institution || '')}" placeholder="e.g. University of California, Berkeley" oninput="window.updateEduField('${edu.id}', 'institution', this.value)">
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Location</label>
              <input type="text" value="${escapeHtml(edu.location || '')}" placeholder="e.g. Berkeley, CA" oninput="window.updateEduField('${edu.id}', 'location', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Duration</label>
              <input type="text" value="${escapeHtml(edu.duration || '')}" placeholder="e.g. 2016 - 2020" oninput="window.updateEduField('${edu.id}', 'duration', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Grade / GPA / Honors</label>
              <input type="text" value="${escapeHtml(edu.grade || '')}" placeholder="e.g. GPA: 3.9 / 4.0 (Honors)" oninput="window.updateEduField('${edu.id}', 'grade', this.value)">
            </div>
          </div>

          <div class="cv-form-group">
            <label>Remarks / Achievements / Coursework</label>
            <input type="text" value="${escapeHtml(edu.remarks || '')}" placeholder="e.g. Dean's Honor List, Specialization in AI" oninput="window.updateEduField('${edu.id}', 'remarks', this.value)">
          </div>
        </div>
      `;
    }).join('');

    return `
      ${listHtml}
      <button class="btn secondary-btn" style="width:100%;" onclick="window.addEduItem()">
        <i class="fas fa-plus"></i> + Add Education
      </button>
    `;
  }

  window.addEduItem = function () {
    if (!currentCv) return;
    currentCv.education = currentCv.education || [];
    currentCv.education.push({
      id: 'edu_' + Math.random().toString(36).substr(2, 6),
      degree: '',
      institution: '',
      location: '',
      duration: '',
      grade: '',
      remarks: ''
    });
    renderAllSectionForms();
    updateLivePreview();
  };

  window.deleteEduItem = function (id) {
    if (!currentCv) return;
    currentCv.education = (currentCv.education || []).filter(e => e.id !== id);
    renderAllSectionForms();
    updateLivePreview();
  };

  window.moveEduItem = function (fromIdx, direction) {
    if (!currentCv) return;
    const list = currentCv.education;
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= list.length) return;
    const temp = list[fromIdx];
    list[fromIdx] = list[toIdx];
    list[toIdx] = temp;
    renderAllSectionForms();
    updateLivePreview();
  };

  window.updateEduField = function (id, field, value) {
    if (!currentCv) return;
    const item = (currentCv.education || []).find(e => e.id === id);
    if (item) {
      item[field] = value;
      updateLivePreview();
    }
  };

  // 5. Technical Skills Form (Categorized + Custom Categories + Individual Skill Management)
  function renderSkillsForm(skillsList) {
    const categoriesHtml = skillsList.map((cat, index) => {
      const isFirst = index === 0;
      const isLast = index === skillsList.length - 1;

      const pillsHtml = (cat.items || []).map((skill, sIdx) => {
        return `
          <span class="cv-skill-tag">
            ${escapeHtml(skill)}
            <button onclick="window.deleteSkillTag('${cat.id}', ${sIdx})" title="Remove skill">&times;</button>
          </span>
        `;
      }).join('');

      return `
        <div class="cv-skills-category-box">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:0.5rem;flex:1;">
              <input type="text" value="${escapeHtml(cat.category || '')}" placeholder="Category Name (e.g. Cloud & DevOps)" style="font-weight:600;font-size:0.85rem;padding:0.35rem 0.5rem;" oninput="window.updateSkillCategoryName('${cat.id}', this.value)">
            </div>
            <div class="cv-item-box-tools">
              ${!isFirst ? `<button class="cv-chip-btn" onclick="window.moveSkillCat(${index}, -1)" title="Move Category Up"><i class="fas fa-arrow-up"></i></button>` : ''}
              ${!isLast ? `<button class="cv-chip-btn" onclick="window.moveSkillCat(${index}, 1)" title="Move Category Down"><i class="fas fa-arrow-down"></i></button>` : ''}
              <button class="cv-chip-btn" style="color:var(--danger-600);" onclick="window.deleteSkillCat('${cat.id}')" title="Delete Category"><i class="fas fa-trash"></i></button>
            </div>
          </div>

          <div class="cv-skills-pills">
            ${pillsHtml}
          </div>

          <div style="display:flex;gap:0.4rem;align-items:center;">
            <input type="text" id="new_skill_input_${cat.id}" placeholder="Type skill and press Enter or Add..." style="flex:1;font-size:0.8rem;padding:0.35rem 0.5rem;" onkeydown="if(event.key==='Enter'){event.preventDefault();window.addSkillTag('${cat.id}');}">
            <button class="btn secondary-btn" style="padding:0.35rem 0.65rem;font-size:0.75rem;" onclick="window.addSkillTag('${cat.id}')">
              <i class="fas fa-plus"></i> Add Skill
            </button>
          </div>
        </div>
      `;
    }).join('');

    return `
      ${categoriesHtml}
      <button class="btn secondary-btn" style="width:100%;margin-top:0.25rem;" onclick="window.addSkillCategory()">
        <i class="fas fa-plus"></i> + Add Custom Skill Category
      </button>
    `;
  }

  window.addSkillCategory = function () {
    if (!currentCv) return;
    currentCv.skills = currentCv.skills || [];
    currentCv.skills.push({
      id: 'cat_' + Math.random().toString(36).substr(2, 6),
      category: 'New Category',
      items: []
    });
    renderAllSectionForms();
    updateLivePreview();
  };

  window.deleteSkillCat = function (catId) {
    if (!currentCv) return;
    currentCv.skills = (currentCv.skills || []).filter(c => c.id !== catId);
    renderAllSectionForms();
    updateLivePreview();
  };

  window.moveSkillCat = function (fromIdx, direction) {
    if (!currentCv) return;
    const list = currentCv.skills;
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= list.length) return;
    const temp = list[fromIdx];
    list[fromIdx] = list[toIdx];
    list[toIdx] = temp;
    renderAllSectionForms();
    updateLivePreview();
  };

  window.updateSkillCategoryName = function (catId, newName) {
    if (!currentCv) return;
    const cat = (currentCv.skills || []).find(c => c.id === catId);
    if (cat) {
      cat.category = newName;
      updateLivePreview();
    }
  };

  window.addSkillTag = function (catId) {
    if (!currentCv) return;
    const input = document.getElementById(`new_skill_input_${catId}`);
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;

    const cat = (currentCv.skills || []).find(c => c.id === catId);
    if (cat) {
      cat.items = cat.items || [];
      cat.items.push(val);
      input.value = '';
      renderAllSectionForms();
      updateLivePreview();
    }
  };

  window.deleteSkillTag = function (catId, sIdx) {
    if (!currentCv) return;
    const cat = (currentCv.skills || []).find(c => c.id === catId);
    if (cat && cat.items) {
      cat.items.splice(sIdx, 1);
      renderAllSectionForms();
      updateLivePreview();
    }
  };

  // 6. Certifications and Training Form
  function renderCertificationsForm(certList) {
    const listHtml = certList.map((cert, index) => {
      const isFirst = index === 0;
      const isLast = index === certList.length - 1;
      return `
        <div class="cv-item-box">
          <div class="cv-item-box-header">
            <div class="cv-item-box-title">#${index + 1}: ${escapeHtml(cert.name || 'Certification')}</div>
            <div class="cv-item-box-tools">
              ${!isFirst ? `<button class="cv-chip-btn" onclick="window.moveCertItem(${index}, -1)" title="Move Up"><i class="fas fa-arrow-up"></i></button>` : ''}
              ${!isLast ? `<button class="cv-chip-btn" onclick="window.moveCertItem(${index}, 1)" title="Move Down"><i class="fas fa-arrow-down"></i></button>` : ''}
              <button class="cv-chip-btn" style="color:var(--danger-600);" onclick="window.deleteCertItem('${cert.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Certification Name *</label>
              <input type="text" value="${escapeHtml(cert.name || '')}" placeholder="e.g. AWS Certified Solutions Architect" oninput="window.updateCertField('${cert.id}', 'name', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Issuing Organization *</label>
              <input type="text" value="${escapeHtml(cert.organization || '')}" placeholder="e.g. Amazon Web Services" oninput="window.updateCertField('${cert.id}', 'organization', this.value)">
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Issue Date</label>
              <input type="text" value="${escapeHtml(cert.issueDate || '')}" placeholder="e.g. 2023-05" oninput="window.updateCertField('${cert.id}', 'issueDate', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Expiration Date</label>
              <input type="text" value="${escapeHtml(cert.expirationDate || '')}" placeholder="e.g. 2026-05 or No Expiration" oninput="window.updateCertField('${cert.id}', 'expirationDate', this.value)">
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Credential ID</label>
              <input type="text" value="${escapeHtml(cert.credentialId || '')}" placeholder="e.g. CERT-123456" oninput="window.updateCertField('${cert.id}', 'credentialId', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Verification URL</label>
              <input type="text" value="${escapeHtml(cert.url || '')}" placeholder="https://..." oninput="window.updateCertField('${cert.id}', 'url', this.value)">
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      ${listHtml}
      <button class="btn secondary-btn" style="width:100%;" onclick="window.addCertItem()">
        <i class="fas fa-plus"></i> + Add Certification / Training
      </button>
    `;
  }

  window.addCertItem = function () {
    if (!currentCv) return;
    currentCv.certifications = currentCv.certifications || [];
    currentCv.certifications.push({
      id: 'cert_' + Math.random().toString(36).substr(2, 6),
      name: '',
      organization: '',
      issueDate: '',
      expirationDate: '',
      credentialId: '',
      url: ''
    });
    renderAllSectionForms();
    updateLivePreview();
  };

  window.deleteCertItem = function (id) {
    if (!currentCv) return;
    currentCv.certifications = (currentCv.certifications || []).filter(c => c.id !== id);
    renderAllSectionForms();
    updateLivePreview();
  };

  window.moveCertItem = function (fromIdx, direction) {
    if (!currentCv) return;
    const list = currentCv.certifications;
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= list.length) return;
    const temp = list[fromIdx];
    list[fromIdx] = list[toIdx];
    list[toIdx] = temp;
    renderAllSectionForms();
    updateLivePreview();
  };

  window.updateCertField = function (id, field, value) {
    if (!currentCv) return;
    const item = (currentCv.certifications || []).find(c => c.id === id);
    if (item) {
      item[field] = value;
      updateLivePreview();
    }
  };

  // 7. Research and Publications Form
  function renderPublicationsForm(pubList) {
    const listHtml = pubList.map((pub, index) => {
      const isFirst = index === 0;
      const isLast = index === pubList.length - 1;
      return `
        <div class="cv-item-box">
          <div class="cv-item-box-header">
            <div class="cv-item-box-title">#${index + 1}: ${escapeHtml(pub.title || 'Publication Title')}</div>
            <div class="cv-item-box-tools">
              ${!isFirst ? `<button class="cv-chip-btn" onclick="window.movePubItem(${index}, -1)" title="Move Up"><i class="fas fa-arrow-up"></i></button>` : ''}
              ${!isLast ? `<button class="cv-chip-btn" onclick="window.movePubItem(${index}, 1)" title="Move Down"><i class="fas fa-arrow-down"></i></button>` : ''}
              <button class="cv-chip-btn" style="color:var(--danger-600);" onclick="window.deletePubItem('${pub.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </div>

          <div class="cv-form-group">
            <label>Publication / Article Title *</label>
            <input type="text" value="${escapeHtml(pub.title || '')}" placeholder="Title of paper or article" oninput="window.updatePubField('${pub.id}', 'title', this.value)">
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Journal / Conference / Publisher</label>
              <input type="text" value="${escapeHtml(pub.publisher || '')}" placeholder="e.g. IEEE Transactions on Cloud Computing" oninput="window.updatePubField('${pub.id}', 'publisher', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Publication Date</label>
              <input type="text" value="${escapeHtml(pub.date || '')}" placeholder="e.g. 2023-11" oninput="window.updatePubField('${pub.id}', 'date', this.value)">
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Co-authors</label>
              <input type="text" value="${escapeHtml(pub.authors || '')}" placeholder="e.g. J. Doe, A. Smith" oninput="window.updatePubField('${pub.id}', 'authors', this.value)">
            </div>
            <div class="cv-form-group">
              <label>DOI / URL</label>
              <input type="text" value="${escapeHtml(pub.url || '')}" placeholder="https://doi.org/..." oninput="window.updatePubField('${pub.id}', 'url', this.value)">
            </div>
          </div>

          <div class="cv-form-group">
            <label>Abstract / Key Contributions</label>
            <textarea rows="2" placeholder="Brief summary of findings..." oninput="window.updatePubField('${pub.id}', 'abstract', this.value)">${escapeHtml(pub.abstract || '')}</textarea>
          </div>
        </div>
      `;
    }).join('');

    return `
      ${listHtml}
      <button class="btn secondary-btn" style="width:100%;" onclick="window.addPubItem()">
        <i class="fas fa-plus"></i> + Add Research / Publication
      </button>
    `;
  }

  window.addPubItem = function () {
    if (!currentCv) return;
    currentCv.publications = currentCv.publications || [];
    currentCv.publications.push({
      id: 'pub_' + Math.random().toString(36).substr(2, 6),
      title: '',
      publisher: '',
      date: '',
      authors: '',
      url: '',
      abstract: ''
    });
    renderAllSectionForms();
    updateLivePreview();
  };

  window.deletePubItem = function (id) {
    if (!currentCv) return;
    currentCv.publications = (currentCv.publications || []).filter(p => p.id !== id);
    renderAllSectionForms();
    updateLivePreview();
  };

  window.movePubItem = function (fromIdx, direction) {
    if (!currentCv) return;
    const list = currentCv.publications;
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= list.length) return;
    const temp = list[fromIdx];
    list[fromIdx] = list[toIdx];
    list[toIdx] = temp;
    renderAllSectionForms();
    updateLivePreview();
  };

  window.updatePubField = function (id, field, value) {
    if (!currentCv) return;
    const item = (currentCv.publications || []).find(p => p.id === id);
    if (item) {
      item[field] = value;
      updateLivePreview();
    }
  };

  // 8. Scholarships and Awards Form
  function renderAwardsForm(awardList) {
    const listHtml = awardList.map((award, index) => {
      const isFirst = index === 0;
      const isLast = index === awardList.length - 1;
      return `
        <div class="cv-item-box">
          <div class="cv-item-box-header">
            <div class="cv-item-box-title">#${index + 1}: ${escapeHtml(award.title || 'Award Title')}</div>
            <div class="cv-item-box-tools">
              ${!isFirst ? `<button class="cv-chip-btn" onclick="window.moveAwardItem(${index}, -1)" title="Move Up"><i class="fas fa-arrow-up"></i></button>` : ''}
              ${!isLast ? `<button class="cv-chip-btn" onclick="window.moveAwardItem(${index}, 1)" title="Move Down"><i class="fas fa-arrow-down"></i></button>` : ''}
              <button class="cv-chip-btn" style="color:var(--danger-600);" onclick="window.deleteAwardItem('${award.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Award / Scholarship Title *</label>
              <input type="text" value="${escapeHtml(award.title || '')}" placeholder="e.g. Excellence in Engineering" oninput="window.updateAwardField('${award.id}', 'title', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Issuer / Organization</label>
              <input type="text" value="${escapeHtml(award.issuer || '')}" placeholder="e.g. National Science Foundation" oninput="window.updateAwardField('${award.id}', 'issuer', this.value)">
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Date Received</label>
              <input type="text" value="${escapeHtml(award.date || '')}" placeholder="e.g. 2023-11" oninput="window.updateAwardField('${award.id}', 'date', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Description / Monetary Grant</label>
              <input type="text" value="${escapeHtml(award.description || '')}" placeholder="e.g. Awarded for top 1% academic achievement" oninput="window.updateAwardField('${award.id}', 'description', this.value)">
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      ${listHtml}
      <button class="btn secondary-btn" style="width:100%;" onclick="window.addAwardItem()">
        <i class="fas fa-plus"></i> + Add Scholarship / Award
      </button>
    `;
  }

  window.addAwardItem = function () {
    if (!currentCv) return;
    currentCv.awards = currentCv.awards || [];
    currentCv.awards.push({
      id: 'award_' + Math.random().toString(36).substr(2, 6),
      title: '',
      issuer: '',
      date: '',
      description: ''
    });
    renderAllSectionForms();
    updateLivePreview();
  };

  window.deleteAwardItem = function (id) {
    if (!currentCv) return;
    currentCv.awards = (currentCv.awards || []).filter(a => a.id !== id);
    renderAllSectionForms();
    updateLivePreview();
  };

  window.moveAwardItem = function (fromIdx, direction) {
    if (!currentCv) return;
    const list = currentCv.awards;
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= list.length) return;
    const temp = list[fromIdx];
    list[fromIdx] = list[toIdx];
    list[toIdx] = temp;
    renderAllSectionForms();
    updateLivePreview();
  };

  window.updateAwardField = function (id, field, value) {
    if (!currentCv) return;
    const item = (currentCv.awards || []).find(a => a.id === id);
    if (item) {
      item[field] = value;
      updateLivePreview();
    }
  };

  // 9. Projects Form
  function renderProjectsForm(projList) {
    const listHtml = projList.map((proj, index) => {
      const isFirst = index === 0;
      const isLast = index === projList.length - 1;

      const bulletsHtml = (proj.highlights || []).map((b, bIdx) => {
        return `
          <div class="cv-bullet-row">
            <input type="text" value="${escapeHtml(b)}" placeholder="Project highlight / milestone..." oninput="window.updateProjBullet('${proj.id}', ${bIdx}, this.value)">
            <button class="cv-bullet-btn delete" onclick="window.deleteProjBullet('${proj.id}', ${bIdx})"><i class="fas fa-trash"></i></button>
          </div>
        `;
      }).join('');

      return `
        <div class="cv-item-box">
          <div class="cv-item-box-header">
            <div class="cv-item-box-title">#${index + 1}: ${escapeHtml(proj.name || 'Project Name')}</div>
            <div class="cv-item-box-tools">
              ${!isFirst ? `<button class="cv-chip-btn" onclick="window.moveProjItem(${index}, -1)" title="Move Up"><i class="fas fa-arrow-up"></i></button>` : ''}
              ${!isLast ? `<button class="cv-chip-btn" onclick="window.moveProjItem(${index}, 1)" title="Move Down"><i class="fas fa-arrow-down"></i></button>` : ''}
              <button class="cv-chip-btn" style="color:var(--danger-600);" onclick="window.deleteProjItem('${proj.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Project Name *</label>
              <input type="text" value="${escapeHtml(proj.name || '')}" placeholder="e.g. Cloud Operations Suite" oninput="window.updateProjField('${proj.id}', 'name', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Role</label>
              <input type="text" value="${escapeHtml(proj.role || '')}" placeholder="e.g. Lead Architect" oninput="window.updateProjField('${proj.id}', 'role', this.value)">
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Technologies Used</label>
              <input type="text" value="${escapeHtml(proj.technologies || '')}" placeholder="e.g. React, Node.js, Firebase, Docker" oninput="window.updateProjField('${proj.id}', 'technologies', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Repository / Live Link</label>
              <input type="text" value="${escapeHtml(proj.link || '')}" placeholder="https://github.com/..." oninput="window.updateProjField('${proj.id}', 'link', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Duration / Date</label>
              <input type="text" value="${escapeHtml(proj.duration || '')}" placeholder="e.g. 2023 - 2024" oninput="window.updateProjField('${proj.id}', 'duration', this.value)">
            </div>
          </div>

          <div class="cv-form-group">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem;">
              <label>Key Highlights</label>
              <button class="btn secondary-btn" style="padding:0.2rem 0.5rem;font-size:0.75rem;" onclick="window.addProjBullet('${proj.id}')">
                <i class="fas fa-plus"></i> Add Highlight
              </button>
            </div>
            <div class="cv-bullets-container">
              ${bulletsHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      ${listHtml}
      <button class="btn secondary-btn" style="width:100%;" onclick="window.addProjItem()">
        <i class="fas fa-plus"></i> + Add Project
      </button>
    `;
  }

  window.addProjItem = function () {
    if (!currentCv) return;
    currentCv.projects = currentCv.projects || [];
    currentCv.projects.push({
      id: 'proj_' + Math.random().toString(36).substr(2, 6),
      name: '',
      role: '',
      technologies: '',
      link: '',
      duration: '',
      highlights: ['Delivered core functional milestone with measurable user impact.']
    });
    renderAllSectionForms();
    updateLivePreview();
  };

  window.deleteProjItem = function (id) {
    if (!currentCv) return;
    currentCv.projects = (currentCv.projects || []).filter(p => p.id !== id);
    renderAllSectionForms();
    updateLivePreview();
  };

  window.moveProjItem = function (fromIdx, direction) {
    if (!currentCv) return;
    const list = currentCv.projects;
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= list.length) return;
    const temp = list[fromIdx];
    list[fromIdx] = list[toIdx];
    list[toIdx] = temp;
    renderAllSectionForms();
    updateLivePreview();
  };

  window.updateProjField = function (id, field, value) {
    if (!currentCv) return;
    const item = (currentCv.projects || []).find(p => p.id === id);
    if (item) {
      item[field] = value;
      updateLivePreview();
    }
  };

  window.addProjBullet = function (id) {
    if (!currentCv) return;
    const item = (currentCv.projects || []).find(p => p.id === id);
    if (item) {
      item.highlights = item.highlights || [];
      item.highlights.push('');
      renderAllSectionForms();
      updateLivePreview();
    }
  };

  window.updateProjBullet = function (id, bIdx, value) {
    if (!currentCv) return;
    const item = (currentCv.projects || []).find(p => p.id === id);
    if (item && item.highlights && item.highlights[bIdx] !== undefined) {
      item.highlights[bIdx] = value;
      updateLivePreview();
    }
  };

  window.deleteProjBullet = function (id, bIdx) {
    if (!currentCv) return;
    const item = (currentCv.projects || []).find(p => p.id === id);
    if (item && item.highlights) {
      item.highlights.splice(bIdx, 1);
      renderAllSectionForms();
      updateLivePreview();
    }
  };

  // 10. Professional Memberships Form
  function renderMembershipsForm(memList) {
    const listHtml = memList.map((mem, index) => {
      const isFirst = index === 0;
      const isLast = index === memList.length - 1;
      return `
        <div class="cv-item-box">
          <div class="cv-item-box-header">
            <div class="cv-item-box-title">#${index + 1}: ${escapeHtml(mem.organization || 'Organization')}</div>
            <div class="cv-item-box-tools">
              ${!isFirst ? `<button class="cv-chip-btn" onclick="window.moveMemItem(${index}, -1)" title="Move Up"><i class="fas fa-arrow-up"></i></button>` : ''}
              ${!isLast ? `<button class="cv-chip-btn" onclick="window.moveMemItem(${index}, 1)" title="Move Down"><i class="fas fa-arrow-down"></i></button>` : ''}
              <button class="cv-chip-btn" style="color:var(--danger-600);" onclick="window.deleteMemItem('${mem.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Organization / Professional Society *</label>
              <input type="text" value="${escapeHtml(mem.organization || '')}" placeholder="e.g. IEEE / ACM / PMI" oninput="window.updateMemField('${mem.id}', 'organization', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Membership Role / Grade</label>
              <input type="text" value="${escapeHtml(mem.role || '')}" placeholder="e.g. Senior Member / Fellow" oninput="window.updateMemField('${mem.id}', 'role', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Active Period</label>
              <input type="text" value="${escapeHtml(mem.period || '')}" placeholder="e.g. 2020 - Present" oninput="window.updateMemField('${mem.id}', 'period', this.value)">
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      ${listHtml}
      <button class="btn secondary-btn" style="width:100%;" onclick="window.addMemItem()">
        <i class="fas fa-plus"></i> + Add Membership
      </button>
    `;
  }

  window.addMemItem = function () {
    if (!currentCv) return;
    currentCv.memberships = currentCv.memberships || [];
    currentCv.memberships.push({
      id: 'mem_' + Math.random().toString(36).substr(2, 6),
      organization: '',
      role: '',
      period: ''
    });
    renderAllSectionForms();
    updateLivePreview();
  };

  window.deleteMemItem = function (id) {
    if (!currentCv) return;
    currentCv.memberships = (currentCv.memberships || []).filter(m => m.id !== id);
    renderAllSectionForms();
    updateLivePreview();
  };

  window.moveMemItem = function (fromIdx, direction) {
    if (!currentCv) return;
    const list = currentCv.memberships;
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= list.length) return;
    const temp = list[fromIdx];
    list[fromIdx] = list[toIdx];
    list[toIdx] = temp;
    renderAllSectionForms();
    updateLivePreview();
  };

  window.updateMemField = function (id, field, value) {
    if (!currentCv) return;
    const item = (currentCv.memberships || []).find(m => m.id === id);
    if (item) {
      item[field] = value;
      updateLivePreview();
    }
  };

  // 11. Languages Form
  function renderLanguagesForm(langList) {
    const listHtml = langList.map((lang, index) => {
      const isFirst = index === 0;
      const isLast = index === langList.length - 1;
      return `
        <div class="cv-item-box">
          <div class="cv-item-box-header">
            <div class="cv-item-box-title">#${index + 1}: ${escapeHtml(lang.language || 'Language')} (${escapeHtml(lang.proficiency || 'Proficiency')})</div>
            <div class="cv-item-box-tools">
              ${!isFirst ? `<button class="cv-chip-btn" onclick="window.moveLangItem(${index}, -1)" title="Move Up"><i class="fas fa-arrow-up"></i></button>` : ''}
              ${!isLast ? `<button class="cv-chip-btn" onclick="window.moveLangItem(${index}, 1)" title="Move Down"><i class="fas fa-arrow-down"></i></button>` : ''}
              <button class="cv-chip-btn" style="color:var(--danger-600);" onclick="window.deleteLangItem('${lang.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Language *</label>
              <input type="text" value="${escapeHtml(lang.language || '')}" placeholder="e.g. English / German / Spanish" oninput="window.updateLangField('${lang.id}', 'language', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Proficiency Level</label>
              <select onchange="window.updateLangField('${lang.id}', 'proficiency', this.value)">
                <option value="Native / Bilingual" ${lang.proficiency === 'Native / Bilingual' ? 'selected' : ''}>Native / Bilingual</option>
                <option value="Full Professional" ${lang.proficiency === 'Full Professional' ? 'selected' : ''}>Full Professional</option>
                <option value="Professional Working" ${lang.proficiency === 'Professional Working' ? 'selected' : ''}>Professional Working</option>
                <option value="Conversational" ${lang.proficiency === 'Conversational' ? 'selected' : ''}>Conversational</option>
                <option value="Elementary" ${lang.proficiency === 'Elementary' ? 'selected' : ''}>Elementary</option>
              </select>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      ${listHtml}
      <button class="btn secondary-btn" style="width:100%;" onclick="window.addLangItem()">
        <i class="fas fa-plus"></i> + Add Language
      </button>
    `;
  }

  window.addLangItem = function () {
    if (!currentCv) return;
    currentCv.languages = currentCv.languages || [];
    currentCv.languages.push({
      id: 'lang_' + Math.random().toString(36).substr(2, 6),
      language: '',
      proficiency: 'Professional Working'
    });
    renderAllSectionForms();
    updateLivePreview();
  };

  window.deleteLangItem = function (id) {
    if (!currentCv) return;
    currentCv.languages = (currentCv.languages || []).filter(l => l.id !== id);
    renderAllSectionForms();
    updateLivePreview();
  };

  window.moveLangItem = function (fromIdx, direction) {
    if (!currentCv) return;
    const list = currentCv.languages;
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= list.length) return;
    const temp = list[fromIdx];
    list[fromIdx] = list[toIdx];
    list[toIdx] = temp;
    renderAllSectionForms();
    updateLivePreview();
  };

  window.updateLangField = function (id, field, value) {
    if (!currentCv) return;
    const item = (currentCv.languages || []).find(l => l.id === id);
    if (item) {
      item[field] = value;
      updateLivePreview();
    }
  };

  // 12. References Form
  function renderReferencesForm(refData) {
    const isUponRequest = !!refData.availableUponRequest;
    const items = refData.items || [];

    const itemsHtml = items.map((ref, index) => {
      return `
        <div class="cv-item-box" style="margin-top:0.5rem;">
          <div class="cv-item-box-header">
            <div class="cv-item-box-title">Reference #${index + 1}: ${escapeHtml(ref.name || 'Contact')}</div>
            <div class="cv-item-box-tools">
              <button class="cv-chip-btn" style="color:var(--danger-600);" onclick="window.deleteRefItem('${ref.id}')"><i class="fas fa-trash"></i></button>
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Full Name *</label>
              <input type="text" value="${escapeHtml(ref.name || '')}" placeholder="e.g. Dr. Jane Smith" oninput="window.updateRefField('${ref.id}', 'name', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Designation / Title</label>
              <input type="text" value="${escapeHtml(ref.designation || '')}" placeholder="e.g. VP of Engineering" oninput="window.updateRefField('${ref.id}', 'designation', this.value)">
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Organization</label>
              <input type="text" value="${escapeHtml(ref.organization || '')}" placeholder="e.g. Acme Innovations" oninput="window.updateRefField('${ref.id}', 'organization', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Relationship</label>
              <input type="text" value="${escapeHtml(ref.relationship || '')}" placeholder="e.g. Former Direct Supervisor" oninput="window.updateRefField('${ref.id}', 'relationship', this.value)">
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Email</label>
              <input type="email" value="${escapeHtml(ref.email || '')}" placeholder="contact@example.com" oninput="window.updateRefField('${ref.id}', 'email', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Phone</label>
              <input type="text" value="${escapeHtml(ref.phone || '')}" placeholder="+1 (555) ..." oninput="window.updateRefField('${ref.id}', 'phone', this.value)">
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div style="background:var(--gray-50);padding:0.75rem;border-radius:var(--radius-md);border:1px solid var(--gray-200);margin-bottom:0.75rem;">
        <label style="font-size:0.85rem;font-weight:600;display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
          <input type="checkbox" ${isUponRequest ? 'checked' : ''} onchange="window.toggleRefUponRequest(this.checked)">
          Display "Available upon request" statement instead of full details
        </label>
      </div>

      ${!isUponRequest ? `
        ${itemsHtml}
        <button class="btn secondary-btn" style="width:100%;margin-top:0.5rem;" onclick="window.addRefItem()">
          <i class="fas fa-plus"></i> + Add Reference Contact
        </button>
      ` : ''}
    `;
  }

  window.toggleRefUponRequest = function (checked) {
    if (!currentCv) return;
    currentCv.references = currentCv.references || {};
    currentCv.references.availableUponRequest = checked;
    renderAllSectionForms();
    updateLivePreview();
  };

  window.addRefItem = function () {
    if (!currentCv) return;
    currentCv.references = currentCv.references || {};
    currentCv.references.items = currentCv.references.items || [];
    currentCv.references.items.push({
      id: 'ref_' + Math.random().toString(36).substr(2, 6),
      name: '',
      designation: '',
      organization: '',
      email: '',
      phone: '',
      relationship: ''
    });
    renderAllSectionForms();
    updateLivePreview();
  };

  window.deleteRefItem = function (id) {
    if (!currentCv) return;
    if (currentCv.references && currentCv.references.items) {
      currentCv.references.items = currentCv.references.items.filter(r => r.id !== id);
      renderAllSectionForms();
      updateLivePreview();
    }
  };

  window.updateRefField = function (id, field, value) {
    if (!currentCv) return;
    if (currentCv.references && currentCv.references.items) {
      const item = currentCv.references.items.find(r => r.id === id);
      if (item) {
        item[field] = value;
        updateLivePreview();
      }
    }
  };

  // ==========================================================================
  // LIVE PREVIEW ENGINE (Reactive A4 Multi-page Renderer)
  // ==========================================================================
  function updateLivePreview() {
    const previewContainer = document.getElementById('cvLivePreviewArea');
    if (!previewContainer || !currentCv) return;

    readTopBarValues();

    const template = currentCv.template || 'modern';
    const cvHtml = renderCvDocumentHtml(currentCv, template);

    previewContainer.innerHTML = cvHtml;
    applyZoom();
  }

  // Zoom controls
  window.cvZoomIn = function () {
    if (cvZoomLevel < 1.4) {
      cvZoomLevel = Math.round((cvZoomLevel + 0.1) * 10) / 10;
      applyZoom();
    }
  };

  window.cvZoomOut = function () {
    if (cvZoomLevel > 0.4) {
      cvZoomLevel = Math.round((cvZoomLevel - 0.1) * 10) / 10;
      applyZoom();
    }
  };

  window.cvZoomFit = function () {
    const scrollArea = document.querySelector('.cv-preview-scroll-area');
    if (scrollArea) {
      const areaWidth = scrollArea.clientWidth - 40;
      // 210mm in pixels is ~794px
      const targetZoom = Math.min(1.0, Math.max(0.4, areaWidth / 800));
      cvZoomLevel = Math.round(targetZoom * 100) / 100;
      applyZoom();
    }
  };

  window.cvZoomReset = function () {
    cvZoomLevel = 1.0;
    applyZoom();
  };

  function applyZoom() {
    const wrapper = document.getElementById('cvZoomWrapper');
    const indicator = document.getElementById('cvZoomPercent');
    if (wrapper) {
      wrapper.style.transform = `scale(${cvZoomLevel})`;
    }
    if (indicator) {
      indicator.textContent = `${Math.round(cvZoomLevel * 100)}%`;
    }
  }

  // ==========================================================================
  // CV HTML Document Compiler (Supports 4 Distinct Professional Templates)
  // ==========================================================================
  function renderCvDocumentHtml(cv, templateKey) {
    const tplClass = `cv-template-${templateKey}`;
    const p = cv.personal || {};
    const visibleSections = (cv.sectionsOrder || DEFAULT_SECTIONS_ORDER).filter(s => {
      return !(cv.hiddenSections || []).includes(s);
    });

    // Contact items
    const contactItems = [];
    if (p.email) contactItems.push(`<span class="cv-contact-item"><i class="fas fa-envelope"></i> ${escapeHtml(p.email)}</span>`);
    if (p.phone) contactItems.push(`<span class="cv-contact-item"><i class="fas fa-phone"></i> ${escapeHtml(p.phone)}</span>`);
    if (p.location) contactItems.push(`<span class="cv-contact-item"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(p.location)}</span>`);
    if (p.linkedin) contactItems.push(`<span class="cv-contact-item"><i class="fab fa-linkedin"></i> ${escapeHtml(p.linkedin)}</span>`);
    if (p.website) contactItems.push(`<span class="cv-contact-item"><i class="fas fa-globe"></i> ${escapeHtml(p.website)}</span>`);
    if (p.github) contactItems.push(`<span class="cv-contact-item"><i class="fab fa-github"></i> ${escapeHtml(p.github)}</span>`);

    // Render individual section blocks
    const renderedSections = {};

    // 1. Summary
    if (cv.summary && cv.summary.trim()) {
      renderedSections.summary = `
        <div class="cv-sec-block cv-avoid-break">
          <div class="cv-sec-title"><i class="fas fa-user-circle"></i> Professional Summary</div>
          <p style="margin:0;font-size:9.5pt;line-height:1.5;color:#333;">${escapeHtml(cv.summary)}</p>
        </div>
      `;
    }

    // 2. Experience
    if (cv.experience && cv.experience.length > 0) {
      const expsHtml = cv.experience.map(exp => {
        const dateStr = exp.startDate ? `${exp.startDate} – ${exp.current ? 'Present' : (exp.endDate || 'Present')}` : '';
        const bulletsHtml = (exp.responsibilities || []).filter(b => b.trim()).map(b => `
          <li class="cv-bullet-item">${escapeHtml(b)}</li>
        `).join('');

        return `
          <div class="cv-entry cv-avoid-break">
            <div class="cv-entry-header">
              <div>
                <span class="cv-entry-title">${escapeHtml(exp.jobTitle || 'Role')}</span>
                ${exp.organization ? ` &bull; <span class="cv-entry-subtitle">${escapeHtml(exp.organization)}</span>` : ''}
                ${exp.department ? `<span style="font-size:8.5pt;color:#666;"> (${escapeHtml(exp.department)})</span>` : ''}
              </div>
              <div class="cv-entry-date">${escapeHtml(dateStr)}</div>
            </div>
            ${exp.location || exp.employmentType ? `
              <div class="cv-entry-location">
                ${exp.location ? escapeHtml(exp.location) : ''}
                ${exp.location && exp.employmentType ? ' &bull; ' : ''}
                ${exp.employmentType ? escapeHtml(exp.employmentType) : ''}
              </div>
            ` : ''}
            ${bulletsHtml ? `<ul class="cv-bullets">${bulletsHtml}</ul>` : ''}
          </div>
        `;
      }).join('');

      renderedSections.experience = `
        <div class="cv-sec-block">
          <div class="cv-sec-title"><i class="fas fa-briefcase"></i> Work Experience</div>
          ${expsHtml}
        </div>
      `;
    }

    // 3. Education
    if (cv.education && cv.education.length > 0) {
      const edusHtml = cv.education.map(edu => `
        <div class="cv-entry cv-avoid-break">
          <div class="cv-entry-header">
            <div>
              <span class="cv-entry-title">${escapeHtml(edu.degree || 'Degree')}</span>
              ${edu.institution ? ` &bull; <span class="cv-entry-subtitle">${escapeHtml(edu.institution)}</span>` : ''}
            </div>
            <div class="cv-entry-date">${escapeHtml(edu.duration || '')}</div>
          </div>
          ${edu.location || edu.grade ? `
            <div class="cv-entry-location">
              ${edu.location ? escapeHtml(edu.location) : ''}
              ${edu.location && edu.grade ? ' &bull; ' : ''}
              ${edu.grade ? `<strong>${escapeHtml(edu.grade)}</strong>` : ''}
            </div>
          ` : ''}
          ${edu.remarks ? `<p style="margin:2px 0 0 0;font-size:8.5pt;color:#555;">${escapeHtml(edu.remarks)}</p>` : ''}
        </div>
      `).join('');

      renderedSections.education = `
        <div class="cv-sec-block">
          <div class="cv-sec-title"><i class="fas fa-graduation-cap"></i> Education</div>
          ${edusHtml}
        </div>
      `;
    }

    // 4. Skills
    if (cv.skills && cv.skills.length > 0) {
      const skillsHtml = cv.skills.map(cat => {
        const badgesHtml = (cat.items || []).map(skill => `
          <span class="cv-skill-badge">${escapeHtml(skill)}</span>
        `).join('');

        return `
          <div class="cv-avoid-break" style="margin-bottom:6px;">
            <span style="font-weight:700;font-size:9pt;color:#222;">${escapeHtml(cat.category || 'Skills')}: </span>
            <span>${badgesHtml}</span>
          </div>
        `;
      }).join('');

      renderedSections.skills = `
        <div class="cv-sec-block">
          <div class="cv-sec-title"><i class="fas fa-code"></i> Technical Skills</div>
          ${skillsHtml}
        </div>
      `;
    }

    // 5. Certifications
    if (cv.certifications && cv.certifications.length > 0) {
      const certsHtml = cv.certifications.map(cert => `
        <div class="cv-entry cv-avoid-break">
          <div class="cv-entry-header">
            <span class="cv-entry-title">${escapeHtml(cert.name || 'Certification')}</span>
            <span class="cv-entry-date">${escapeHtml(cert.issueDate || '')}</span>
          </div>
          <div style="font-size:8.5pt;color:#555;">
            ${escapeHtml(cert.organization || '')}
            ${cert.credentialId ? ` &bull; ID: ${escapeHtml(cert.credentialId)}` : ''}
            ${cert.expirationDate ? ` &bull; Expires: ${escapeHtml(cert.expirationDate)}` : ''}
          </div>
        </div>
      `).join('');

      renderedSections.certifications = `
        <div class="cv-sec-block">
          <div class="cv-sec-title"><i class="fas fa-certificate"></i> Certifications & Training</div>
          ${certsHtml}
        </div>
      `;
    }

    // 6. Publications
    if (cv.publications && cv.publications.length > 0) {
      const pubsHtml = cv.publications.map(pub => `
        <div class="cv-entry cv-avoid-break">
          <div class="cv-entry-header">
            <span class="cv-entry-title">${escapeHtml(pub.title || '')}</span>
            <span class="cv-entry-date">${escapeHtml(pub.date || '')}</span>
          </div>
          <div style="font-size:8.5pt;color:#444;margin-top:2px;">
            ${pub.authors ? `<em>${escapeHtml(pub.authors)}</em> &bull; ` : ''}
            <strong>${escapeHtml(pub.publisher || '')}</strong>
            ${pub.url ? ` &bull; <a href="${escapeHtml(pub.url)}" target="_blank" style="color:#2563eb;">Link</a>` : ''}
          </div>
          ${pub.abstract ? `<p style="margin:2px 0 0 0;font-size:8.5pt;color:#666;font-style:italic;">${escapeHtml(pub.abstract)}</p>` : ''}
        </div>
      `).join('');

      renderedSections.publications = `
        <div class="cv-sec-block">
          <div class="cv-sec-title"><i class="fas fa-book-open"></i> Research & Publications</div>
          ${pubsHtml}
        </div>
      `;
    }

    // 7. Awards
    if (cv.awards && cv.awards.length > 0) {
      const awardsHtml = cv.awards.map(award => `
        <div class="cv-entry cv-avoid-break">
          <div class="cv-entry-header">
            <span class="cv-entry-title">${escapeHtml(award.title || '')}</span>
            <span class="cv-entry-date">${escapeHtml(award.date || '')}</span>
          </div>
          <div style="font-size:8.5pt;color:#555;">
            ${escapeHtml(award.issuer || '')}
            ${award.description ? ` &bull; ${escapeHtml(award.description)}` : ''}
          </div>
        </div>
      `).join('');

      renderedSections.awards = `
        <div class="cv-sec-block">
          <div class="cv-sec-title"><i class="fas fa-trophy"></i> Scholarships & Awards</div>
          ${awardsHtml}
        </div>
      `;
    }

    // 8. Projects
    if (cv.projects && cv.projects.length > 0) {
      const projsHtml = cv.projects.map(proj => {
        const bulletsHtml = (proj.highlights || []).filter(h => h.trim()).map(h => `
          <li class="cv-bullet-item">${escapeHtml(h)}</li>
        `).join('');

        return `
          <div class="cv-entry cv-avoid-break">
            <div class="cv-entry-header">
              <div>
                <span class="cv-entry-title">${escapeHtml(proj.name || 'Project')}</span>
                ${proj.role ? ` &bull; <span class="cv-entry-subtitle">${escapeHtml(proj.role)}</span>` : ''}
              </div>
              <div class="cv-entry-date">${escapeHtml(proj.duration || '')}</div>
            </div>
            ${proj.technologies ? `<div style="font-size:8.5pt;color:#4b5563;"><strong>Stack:</strong> ${escapeHtml(proj.technologies)}</div>` : ''}
            ${bulletsHtml ? `<ul class="cv-bullets">${bulletsHtml}</ul>` : ''}
          </div>
        `;
      }).join('');

      renderedSections.projects = `
        <div class="cv-sec-block">
          <div class="cv-sec-title"><i class="fas fa-diagram-project"></i> Projects</div>
          ${projsHtml}
        </div>
      `;
    }

    // 9. Memberships
    if (cv.memberships && cv.memberships.length > 0) {
      const memsHtml = cv.memberships.map(mem => `
        <div class="cv-entry cv-avoid-break" style="display:flex;justify-content:space-between;font-size:9pt;">
          <div>
            <strong>${escapeHtml(mem.organization || '')}</strong>
            ${mem.role ? ` &ndash; <em>${escapeHtml(mem.role)}</em>` : ''}
          </div>
          <div class="cv-entry-date">${escapeHtml(mem.period || '')}</div>
        </div>
      `).join('');

      renderedSections.memberships = `
        <div class="cv-sec-block">
          <div class="cv-sec-title"><i class="fas fa-users-rectangle"></i> Professional Memberships</div>
          ${memsHtml}
        </div>
      `;
    }

    // 10. Languages
    if (cv.languages && cv.languages.length > 0) {
      const langsHtml = cv.languages.map(lang => `
        <span style="display:inline-block;margin-right:12px;font-size:9pt;">
          <strong>${escapeHtml(lang.language)}:</strong> <span style="color:#555;">${escapeHtml(lang.proficiency)}</span>
        </span>
      `).join('');

      renderedSections.languages = `
        <div class="cv-sec-block cv-avoid-break">
          <div class="cv-sec-title"><i class="fas fa-language"></i> Languages</div>
          <div>${langsHtml}</div>
        </div>
      `;
    }

    // 11. References
    if (cv.references) {
      if (cv.references.availableUponRequest) {
        renderedSections.references = `
          <div class="cv-sec-block cv-avoid-break">
            <div class="cv-sec-title"><i class="fas fa-user-check"></i> References</div>
            <p style="margin:0;font-size:9pt;font-style:italic;color:#555;">Available upon request.</p>
          </div>
        `;
      } else if (cv.references.items && cv.references.items.length > 0) {
        const refsHtml = cv.references.items.map(ref => `
          <div class="cv-entry cv-avoid-break" style="font-size:9pt;">
            <strong>${escapeHtml(ref.name || '')}</strong>
            ${ref.designation ? ` &bull; ${escapeHtml(ref.designation)}` : ''}
            ${ref.organization ? `, ${escapeHtml(ref.organization)}` : ''}
            <div style="font-size:8.5pt;color:#666;">
              ${ref.email ? `Email: ${escapeHtml(ref.email)}` : ''}
              ${ref.email && ref.phone ? ' &bull; ' : ''}
              ${ref.phone ? `Tel: ${escapeHtml(ref.phone)}` : ''}
              ${ref.relationship ? ` (${escapeHtml(ref.relationship)})` : ''}
            </div>
          </div>
        `).join('');

        renderedSections.references = `
          <div class="cv-sec-block">
            <div class="cv-sec-title"><i class="fas fa-user-check"></i> References</div>
            ${refsHtml}
          </div>
        `;
      }
    }

    // Header HTML
    const headerHtml = `
      <div class="cv-header">
        <h1 class="cv-name">${escapeHtml(p.fullName || 'Your Name')}</h1>
        ${p.jobTitle ? `<div class="cv-headline">${escapeHtml(p.jobTitle)}</div>` : ''}
        <div class="cv-contact-row">
          ${contactItems.join('')}
        </div>
      </div>
    `;

    // Template 3: Two-Column Minimalist Layout
    if (templateKey === 'minimal') {
      const leftSectionKeys = ['skills', 'languages', 'certifications', 'memberships', 'awards'];
      const leftColContent = [];
      const rightColContent = [];

      visibleSections.forEach(secKey => {
        if (renderedSections[secKey]) {
          if (leftSectionKeys.includes(secKey)) {
            leftColContent.push(renderedSections[secKey]);
          } else {
            rightColContent.push(renderedSections[secKey]);
          }
        }
      });

      return `
        <div class="cv-a4-sheet ${tplClass}">
          ${headerHtml}
          <div class="cv-two-col-grid">
            <div class="cv-left-col">
              ${leftColContent.join('')}
            </div>
            <div class="cv-right-col">
              ${rightColContent.join('')}
            </div>
          </div>
          <div class="cv-sheet-footer">
            <span>${escapeHtml(p.fullName || 'Candidate')} &bull; Curriculum Vitae</span>
            <span>${escapeHtml(p.jobTitle || 'Curriculum Vitae')}</span>
          </div>
        </div>
      `;
    }

    // Template 1 (Modern), Template 2 (Classic), Template 4 (ATS)
    const bodyContent = visibleSections.map(secKey => renderedSections[secKey] || '').join('');

    return `
      <div class="cv-a4-sheet ${tplClass}">
        ${headerHtml}
        <div class="cv-body-content">
          ${bodyContent}
        </div>
        <div class="cv-sheet-footer">
          <span>${escapeHtml(p.fullName || 'Candidate')} &bull; Curriculum Vitae</span>
          <span>${escapeHtml(p.jobTitle || 'Curriculum Vitae')}</span>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // EXPORT 1: Save as *.cv (JSON)
  // ==========================================================================
  window.downloadCvFileById = function (cvId) {
    const cv = window.cvsCache.find(c => c.id === cvId);
    if (!cv) return;
    downloadCvJson(cv);
  };

  window.downloadCurrentCvAsFile = function () {
    if (!currentCv) return;
    readTopBarValues();
    downloadCvJson(currentCv);
  };

  function downloadCvJson(cvData) {
    const jsonString = JSON.stringify(cvData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const filename = `${sanitizeFilename(cvData.title || 'Curriculum_Vitae')}.cv`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    showFloatingNotification(`Saved as ${filename}`);
  }

  // ==========================================================================
  // EXPORT 2: Load as *.cv (File Upload)
  // ==========================================================================
  window.triggerCvFileImport = function () {
    const input = document.getElementById('cvFileInput');
    if (input) {
      input.value = '';
      input.click();
    }
  };

  window.handleCvFileSelected = function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid CV file structure.');
        }

        // Assign a fresh ID or keep existing, update timestamp
        parsed.id = 'cv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        parsed.updatedAt = new Date().toISOString();
        if (window.currentUser) {
          parsed.createdBy = window.currentUser.email;
          parsed.createdByName = window.currentUser.displayName || window.currentUser.email;
        }

        // Save and open in editor
        saveCvToStorage(parsed);
        currentCv = parsed;
        openCvEditor(currentCv);
        showFloatingNotification(`Loaded CV from ${file.name}`);
      } catch (err) {
        console.error('CV File Read Error:', err);
        alert('Failed to read *.cv file. Please ensure it is a valid CV file.');
      }
    };
    reader.readAsText(file);
  };

  // ==========================================================================
  // EXPORT 3: Export to PDF (Crisp multi-page A4)
  // ==========================================================================
  window.exportCvPdfById = function (cvId) {
    const cv = window.cvsCache.find(c => c.id === cvId);
    if (!cv) return;
    generatePdfForCv(cv);
  };

  window.exportCurrentCvPdf = function () {
    if (!currentCv) return;
    readTopBarValues();
    generatePdfForCv(currentCv);
  };

  function generatePdfForCv(cvData) {
    showFloatingNotification('Compiling professional PDF...');

    // Create a temporary container for PDF compilation matching exact printable area
    const tempContainer = document.createElement('div');
    tempContainer.className = 'cv-pdf-export-host';
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    // Printable width: A4 width (210mm) - Left Margin (15mm) - Right Margin (15mm) = 180mm
    tempContainer.style.width = '210mm';
    tempContainer.style.boxSizing = 'border-box';
    tempContainer.innerHTML = renderCvDocumentHtml(cvData, cvData.template || 'modern');
    document.body.appendChild(tempContainer);

    const sheet = tempContainer.querySelector('.cv-a4-sheet');
    if (sheet) {
      sheet.style.boxShadow = 'none';
      sheet.style.margin = '0';
      sheet.style.width = '100%';
      sheet.style.maxWidth = '210mm';
      sheet.style.boxSizing = 'border-box';
      // Reset sheet padding so jsPDF margins govern page spacing consistently.
      // 3mm top breathing space on page 1, while subsequent pages receive standard 18mm margin.
      sheet.style.padding = '3mm 0 0 0';
      sheet.style.minHeight = 'auto';
    }

    // Remove absolute preview footer so it doesn't overlap text or cause trailing blank page
    const footers = tempContainer.querySelectorAll('.cv-sheet-footer');
    footers.forEach(f => f.remove());

    const filename = `${sanitizeFilename(cvData.title || 'Curriculum_Vitae')}.pdf`;

    if (window.html2pdf) {
      const opt = {
        // Standard margins: Top 18mm, Left 15mm, Bottom 16mm, Right 15mm
        // Ensures subsequent pages after first receive standard 18mm top margin
        margin: [18, 15, 16, 15],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          scrollX: 0,
          scrollY: 0,
          logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: {
          mode: ['css', 'legacy'],
          before: '.cv-page-break-before, .html2pdf__page-break',
          after: '.cv-page-break-after',
          avoid: [
            '.cv-avoid-break',
            '.cv-entry',
            '.cv-sec-title',
            '.cv-header',
            '.cv-bullet-item',
            '.cv-contact-row',
            '.cv-contact-item',
            '.cv-skill-badge',
            '.cv-skill-item',
            'h1', 'h2', 'h3', 'h4',
            'p', 'li'
          ]
        }
      };

      window.html2pdf()
        .set(opt)
        .from(sheet || tempContainer)
        .toPdf()
        .get('pdf')
        .then(pdf => {
          const totalPages = pdf.internal.getNumberOfPages();
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const marginX = 15;
          const footerY = pageHeight - 9;
          const lineY = footerY - 3;
          const candidateName = (cvData.personal?.fullName || cvData.title || 'Curriculum Vitae').trim();
          const footerLabel = `${candidateName} • Curriculum Vitae`;

          // Add a crisp footer on every page so the reader always knows whose CV it is
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);

            // Clean subtle divider line
            pdf.setDrawColor(210, 215, 222);
            pdf.setLineWidth(0.2);
            pdf.line(marginX, lineY, pageWidth - marginX, lineY);

            // Footer text
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(115, 120, 130);

            // Left: Candidate Name & CV label
            pdf.text(footerLabel, marginX, footerY);

            // Right: Page counter if multiple pages, or document marker
            const pageStr = totalPages > 1 ? `Page ${i} of ${totalPages}` : 'Curriculum Vitae';
            pdf.text(pageStr, pageWidth - marginX, footerY, { align: 'right' });
          }
        })
        .save()
        .then(() => {
          if (tempContainer.parentNode) {
            tempContainer.parentNode.removeChild(tempContainer);
          }
          showFloatingNotification('PDF downloaded successfully!');
        }).catch(err => {
          console.error('PDF export error:', err);
          if (tempContainer.parentNode) {
            tempContainer.parentNode.removeChild(tempContainer);
          }
          window.print();
        });
    } else {
      // Fallback to print
      if (tempContainer.parentNode) {
        tempContainer.parentNode.removeChild(tempContainer);
      }
      window.print();
    }
  }

  // ==========================================================================
  // EXPORT 4: Export to MS Word (.doc with native Word styling)
  // ==========================================================================
  window.exportCvWordById = function (cvId) {
    const cv = window.cvsCache.find(c => c.id === cvId);
    if (!cv) return;
    generateWordForCv(cv);
  };

  window.exportCurrentCvWord = function () {
    if (!currentCv) return;
    readTopBarValues();
    generateWordForCv(currentCv);
  };

  function generateWordForCv(cvData) {
    showFloatingNotification('Generating MS Word document...');

    const p = cvData.personal || {};
    const visibleSections = (cvData.sectionsOrder || DEFAULT_SECTIONS_ORDER).filter(s => {
      return !(cvData.hiddenSections || []).includes(s);
    });

    let sectionsWordHtml = '';

    visibleSections.forEach(secKey => {
      switch (secKey) {
        case 'summary':
          if (cvData.summary) {
            sectionsWordHtml += `
              <div class="sec-heading">PROFESSIONAL SUMMARY</div>
              <div class="rule"></div>
              <p class="summary-text">${escapeHtml(cvData.summary)}</p>
            `;
          }
          break;

        case 'experience':
          if (cvData.experience && cvData.experience.length > 0) {
            sectionsWordHtml += `
              <div class="sec-heading">WORK EXPERIENCE</div>
              <div class="rule"></div>
            `;
            cvData.experience.forEach(exp => {
              const dateStr = exp.startDate ? `${exp.startDate} &ndash; ${exp.current ? 'Present' : (exp.endDate || 'Present')}` : '';
              const bullets = (exp.responsibilities || []).filter(b => b.trim()).map(b => `
                <li class="bullet">${escapeHtml(b)}</li>
              `).join('');

              sectionsWordHtml += `
                <table class="item-table" width="100%">
                  <tr>
                    <td class="bold-title">${escapeHtml(exp.jobTitle || 'Role')} &bull; ${escapeHtml(exp.organization || '')}</td>
                    <td class="right-date">${dateStr}</td>
                  </tr>
                </table>
                <div class="sub-meta">${escapeHtml(exp.location || '')}${exp.location && exp.employmentType ? ' &bull; ' : ''}${escapeHtml(exp.employmentType || '')}</div>
                ${bullets ? `<ul class="bullet-list">${bullets}</ul>` : ''}
                <div style="margin-bottom: 8pt;"></div>
              `;
            });
          }
          break;

        case 'education':
          if (cvData.education && cvData.education.length > 0) {
            sectionsWordHtml += `
              <div class="sec-heading">EDUCATION</div>
              <div class="rule"></div>
            `;
            cvData.education.forEach(edu => {
              sectionsWordHtml += `
                <table class="item-table" width="100%">
                  <tr>
                    <td class="bold-title">${escapeHtml(edu.degree || '')} &bull; ${escapeHtml(edu.institution || '')}</td>
                    <td class="right-date">${escapeHtml(edu.duration || '')}</td>
                  </tr>
                </table>
                <div class="sub-meta">${escapeHtml(edu.location || '')}${edu.grade ? ` &bull; ${escapeHtml(edu.grade)}` : ''}</div>
                ${edu.remarks ? `<p class="remarks-text">${escapeHtml(edu.remarks)}</p>` : ''}
                <div style="margin-bottom: 6pt;"></div>
              `;
            });
          }
          break;

        case 'skills':
          if (cvData.skills && cvData.skills.length > 0) {
            sectionsWordHtml += `
              <div class="sec-heading">TECHNICAL SKILLS</div>
              <div class="rule"></div>
            `;
            cvData.skills.forEach(cat => {
              const skillsStr = (cat.items || []).join(', ');
              sectionsWordHtml += `
                <p style="margin: 3pt 0; font-size: 10pt;">
                  <strong>${escapeHtml(cat.category || 'Skills')}:</strong> ${escapeHtml(skillsStr)}
                </p>
              `;
            });
          }
          break;

        case 'certifications':
          if (cvData.certifications && cvData.certifications.length > 0) {
            sectionsWordHtml += `
              <div class="sec-heading">CERTIFICATIONS AND TRAINING</div>
              <div class="rule"></div>
            `;
            cvData.certifications.forEach(cert => {
              sectionsWordHtml += `
                <table class="item-table" width="100%">
                  <tr>
                    <td class="bold-title">${escapeHtml(cert.name || '')} &bull; ${escapeHtml(cert.organization || '')}</td>
                    <td class="right-date">${escapeHtml(cert.issueDate || '')}</td>
                  </tr>
                </table>
                ${cert.credentialId ? `<div class="sub-meta">Credential ID: ${escapeHtml(cert.credentialId)}</div>` : ''}
              `;
            });
          }
          break;

        case 'publications':
          if (cvData.publications && cvData.publications.length > 0) {
            sectionsWordHtml += `
              <div class="sec-heading">RESEARCH AND PUBLICATIONS</div>
              <div class="rule"></div>
            `;
            cvData.publications.forEach(pub => {
              sectionsWordHtml += `
                <table class="item-table" width="100%">
                  <tr>
                    <td class="bold-title">&ldquo;${escapeHtml(pub.title || '')}&rdquo;</td>
                    <td class="right-date">${escapeHtml(pub.date || '')}</td>
                  </tr>
                </table>
                <div class="sub-meta">${escapeHtml(pub.authors || '')} &bull; <em>${escapeHtml(pub.publisher || '')}</em></div>
                ${pub.abstract ? `<p class="remarks-text">${escapeHtml(pub.abstract)}</p>` : ''}
              `;
            });
          }
          break;

        case 'awards':
          if (cvData.awards && cvData.awards.length > 0) {
            sectionsWordHtml += `
              <div class="sec-heading">SCHOLARSHIPS AND AWARDS</div>
              <div class="rule"></div>
            `;
            cvData.awards.forEach(award => {
              sectionsWordHtml += `
                <table class="item-table" width="100%">
                  <tr>
                    <td class="bold-title">${escapeHtml(award.title || '')} &ndash; ${escapeHtml(award.issuer || '')}</td>
                    <td class="right-date">${escapeHtml(award.date || '')}</td>
                  </tr>
                </table>
                ${award.description ? `<div class="sub-meta">${escapeHtml(award.description)}</div>` : ''}
              `;
            });
          }
          break;

        case 'projects':
          if (cvData.projects && cvData.projects.length > 0) {
            sectionsWordHtml += `
              <div class="sec-heading">PROJECTS</div>
              <div class="rule"></div>
            `;
            cvData.projects.forEach(proj => {
              const bullets = (proj.highlights || []).filter(h => h.trim()).map(h => `
                <li class="bullet">${escapeHtml(h)}</li>
              `).join('');

              sectionsWordHtml += `
                <table class="item-table" width="100%">
                  <tr>
                    <td class="bold-title">${escapeHtml(proj.name || 'Project')}${proj.role ? ` (${escapeHtml(proj.role)})` : ''}</td>
                    <td class="right-date">${escapeHtml(proj.duration || '')}</td>
                  </tr>
                </table>
                ${proj.technologies ? `<div class="sub-meta">Technologies: ${escapeHtml(proj.technologies)}</div>` : ''}
                ${bullets ? `<ul class="bullet-list">${bullets}</ul>` : ''}
              `;
            });
          }
          break;

        case 'memberships':
          if (cvData.memberships && cvData.memberships.length > 0) {
            sectionsWordHtml += `
              <div class="sec-heading">PROFESSIONAL MEMBERSHIPS</div>
              <div class="rule"></div>
            `;
            cvData.memberships.forEach(mem => {
              sectionsWordHtml += `
                <table class="item-table" width="100%">
                  <tr>
                    <td class="bold-title">${escapeHtml(mem.organization || '')} (${escapeHtml(mem.role || '')})</td>
                    <td class="right-date">${escapeHtml(mem.period || '')}</td>
                  </tr>
                </table>
              `;
            });
          }
          break;

        case 'languages':
          if (cvData.languages && cvData.languages.length > 0) {
            sectionsWordHtml += `
              <div class="sec-heading">LANGUAGES</div>
              <div class="rule"></div>
              <p style="font-size: 10pt;">
                ${cvData.languages.map(l => `<strong>${escapeHtml(l.language)}:</strong> ${escapeHtml(l.proficiency)}`).join(' &bull; ')}
              </p>
            `;
          }
          break;

        case 'references':
          if (cvData.references) {
            sectionsWordHtml += `
              <div class="sec-heading">REFERENCES</div>
              <div class="rule"></div>
            `;
            if (cvData.references.availableUponRequest) {
              sectionsWordHtml += `<p style="font-style:italic;font-size:10pt;">Available upon request.</p>`;
            } else if (cvData.references.items && cvData.references.items.length > 0) {
              cvData.references.items.forEach(ref => {
                sectionsWordHtml += `
                  <p style="margin: 3pt 0; font-size: 10pt;">
                    <strong>${escapeHtml(ref.name || '')}</strong> &ndash; ${escapeHtml(ref.designation || '')}, ${escapeHtml(ref.organization || '')}<br/>
                    <span style="font-size:9pt;color:#555;">Email: ${escapeHtml(ref.email || '')} &bull; Phone: ${escapeHtml(ref.phone || '')}</span>
                  </p>
                `;
              });
            }
          }
          break;
      }
    });

    // Word Document Template with Word MSO XML
    const wordDocumentContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(cvData.title || 'Curriculum Vitae')}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page Section1 {
            size: 595.3pt 841.9pt; /* A4 */
            margin: 54.0pt 54.0pt 54.0pt 54.0pt; /* 0.75 in */
            mso-header-margin: 36.0pt;
            mso-footer-margin: 36.0pt;
            mso-paper-source: 0;
          }
          div.Section1 { page: Section1; }
          body {
            font-family: Calibri, 'Segoe UI', Arial, sans-serif;
            font-size: 10.5pt;
            line-height: 1.35;
            color: #1a1a1a;
          }
          h1.doc-name {
            font-size: 20pt;
            font-weight: bold;
            color: #1e3a8a;
            margin: 0 0 2pt 0;
            text-align: left;
          }
          div.doc-headline {
            font-size: 12pt;
            font-weight: 600;
            color: #4b5563;
            margin-bottom: 4pt;
          }
          div.contact-line {
            font-size: 9pt;
            color: #4b5563;
            margin-bottom: 12pt;
          }
          div.sec-heading {
            font-size: 11pt;
            font-weight: bold;
            color: #1e3a8a;
            margin-top: 10pt;
            margin-bottom: 2pt;
            letter-spacing: 0.5pt;
          }
          div.rule {
            border-bottom: 1.5pt solid #3b82f6;
            margin-bottom: 6pt;
          }
          table.item-table {
            border-collapse: collapse;
            margin-top: 4pt;
          }
          td.bold-title {
            font-size: 10.5pt;
            font-weight: bold;
            color: #111827;
            text-align: left;
          }
          td.right-date {
            font-size: 9pt;
            font-weight: 600;
            color: #6b7280;
            text-align: right;
            white-space: nowrap;
          }
          div.sub-meta {
            font-size: 9pt;
            font-style: italic;
            color: #6b7280;
            margin-bottom: 2pt;
          }
          ul.bullet-list {
            margin: 2pt 0 6pt 18pt;
            padding: 0;
          }
          li.bullet {
            font-size: 9.5pt;
            margin-bottom: 2pt;
            color: #374151;
          }
          p.summary-text {
            font-size: 10pt;
            line-height: 1.4;
            color: #374151;
            margin: 0 0 8pt 0;
          }
          p.remarks-text {
            font-size: 9pt;
            color: #555;
            margin: 2pt 0 4pt 0;
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          <h1 class="doc-name">${escapeHtml(p.fullName || 'Full Name')}</h1>
          ${p.jobTitle ? `<div class="doc-headline">${escapeHtml(p.jobTitle)}</div>` : ''}
          <div class="contact-line">
            ${[p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean).map(escapeHtml).join(' | ')}
          </div>
          ${sectionsWordHtml}
          <div style="margin-top:24pt;border-top:1pt solid #d1d5db;padding-top:4pt;font-size:8.5pt;color:#6b7280;">
            ${escapeHtml(p.fullName || 'Candidate')} &bull; Curriculum Vitae
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', wordDocumentContent], {
      type: 'application/msword'
    });

    const filename = `${sanitizeFilename(cvData.title || 'Curriculum_Vitae')}.doc`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    showFloatingNotification(`Word document downloaded (${filename})`);
  }

  // ==========================================================================
  // PRINT PREVIEW
  // ==========================================================================
  window.triggerCvPrintPreview = function () {
    if (!currentCv) return;
    readTopBarValues();

    // Prepare print area
    let printArea = document.getElementById('cvPrintArea');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'cvPrintArea';
      document.body.appendChild(printArea);
    }

    printArea.innerHTML = renderCvDocumentHtml(currentCv, currentCv.template || 'modern');
    window.print();
  };

  // Delete CV
  window.deleteCvById = async function (cvId) {
    if (!confirm('Are you sure you want to delete this CV? This action cannot be undone.')) {
      return;
    }
    await deleteCvFromStorage(cvId);
    showFloatingNotification('CV deleted.');
    renderCvListView();
  };

  // ==========================================================================
  // Utilities
  // ==========================================================================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sanitizeFilename(name) {
    return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'CV';
  }

  function showFloatingNotification(msg) {
    let toast = document.getElementById('cvToastNotification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'cvToastNotification';
      toast.style.position = 'fixed';
      toast.style.bottom = '24px';
      toast.style.right = '24px';
      toast.style.background = '#1e3a8a';
      toast.style.color = '#fff';
      toast.style.padding = '0.75rem 1.25rem';
      toast.style.borderRadius = '8px';
      toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
      toast.style.fontSize = '0.875rem';
      toast.style.fontWeight = '600';
      toast.style.zIndex = '9999';
      toast.style.transition = 'all 0.3s ease';
      document.body.appendChild(toast);
    }

    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, 2800);
  }

  // ==========================================================================
  // Initialization & Event Attachments
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    // CV search and filter listeners
    ['cvSearch', 'cvVisibilityFilter', 'cvTemplateFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', renderCvListView);
        el.addEventListener('change', renderCvListView);
      }
    });

    // Top bar inputs change triggers live preview update
    ['cvDocTitle', 'cvDocVisibility', 'cvDocTemplate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateLivePreview);
        el.addEventListener('change', updateLivePreview);
      }
    });

    // File input listener for loading *.cv
    const fileInput = document.getElementById('cvFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', window.handleCvFileSelected);
    }
  });

})();
