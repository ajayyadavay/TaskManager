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

  // ==========================================================================
  // Page Setup (PDF export, Print & Word): page size, orientation, margins
  // Default: A4 Portrait with Standard 20 mm margins on all sides.
  // ==========================================================================
  const CV_PAGE_SIZES = {
    a4: { label: 'A4 (210 × 297 mm)', w: 210, h: 297 },
    letter: { label: 'US Letter (8.5 × 11 in)', w: 215.9, h: 279.4 },
    legal: { label: 'US Legal (8.5 × 14 in)', w: 215.9, h: 355.6 },
    a5: { label: 'A5 (148 × 210 mm)', w: 148, h: 210 },
    a3: { label: 'A3 (297 × 420 mm)', w: 297, h: 420 }
  };

  const CV_MARGIN_PRESETS = {
    standard: { label: 'Standard – 20 mm all sides', top: 20, right: 20, bottom: 20, left: 20 },
    narrow: { label: 'Narrow – 12.7 mm (0.5 in)', top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 },
    moderate: { label: 'Moderate – 25.4 mm top/bottom, 19.1 mm sides', top: 25.4, right: 19.1, bottom: 25.4, left: 19.1 },
    normal: { label: 'Wide – 25.4 mm (1 in) all sides', top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 },
    custom: { label: 'Custom…' }
  };

  const CV_PAGE_SETUP_DEFAULT_KEY = 'taskay_cv_page_setup_default';
  const CV_MIN_MARGIN_MM = 5;
  const CV_MAX_MARGIN_MM = 60;
  const CV_FOOTER_MIN_BOTTOM_MM = 10; // room for the PDF footer inside the bottom margin

  function getStandardPageSetup() {
    return {
      size: 'a4',
      orientation: 'portrait',
      marginPreset: 'standard',
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      showFooter: true
    };
  }

  function normalizePageSetup(ps) {
    const std = getStandardPageSetup();
    const out = Object.assign({}, std, ps || {});
    if (!CV_PAGE_SIZES[out.size]) out.size = std.size;
    if (out.orientation !== 'landscape') out.orientation = 'portrait';
    if (!CV_MARGIN_PRESETS[out.marginPreset]) out.marginPreset = 'custom';
    out.showFooter = out.showFooter !== false;

    const src = (ps && ps.margins) || std.margins;
    const m = {};
    ['top', 'right', 'bottom', 'left'].forEach(k => {
      let v = parseFloat(src[k]);
      if (!isFinite(v)) v = std.margins[k];
      m[k] = Math.round(Math.min(CV_MAX_MARGIN_MM, Math.max(CV_MIN_MARGIN_MM, v)) * 10) / 10;
    });
    if (out.showFooter && m.bottom < CV_FOOTER_MIN_BOTTOM_MM) m.bottom = CV_FOOTER_MIN_BOTTOM_MM;
    out.margins = m;

    // Guarantee a usable printable area so content is never squeezed or cropped
    const geo = getPageGeometry(out);
    if (geo.innerW < 90 || geo.innerH < 120) {
      out.marginPreset = 'standard';
      out.margins = Object.assign({}, std.margins);
    }
    return out;
  }

  function getPageGeometry(ps) {
    const size = CV_PAGE_SIZES[ps.size] || CV_PAGE_SIZES.a4;
    const landscape = ps.orientation === 'landscape';
    const w = landscape ? size.h : size.w;
    const h = landscape ? size.w : size.h;
    const m = ps.margins || getStandardPageSetup().margins;
    return {
      w, h, m,
      innerW: Math.round((w - m.left - m.right) * 10) / 10,
      innerH: Math.round((h - m.top - m.bottom) * 10) / 10
    };
  }

  function getUserDefaultPageSetup() {
    try {
      const raw = localStorage.getItem(CV_PAGE_SETUP_DEFAULT_KEY);
      if (raw) return normalizePageSetup(JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return getStandardPageSetup();
  }

  function getCvPageSetup(cv) {
    return normalizePageSetup((cv && cv.pageSetup) || getUserDefaultPageSetup());
  }

  function describePageSetup(ps) {
    const sizeName = { a4: 'A4', letter: 'Letter', legal: 'Legal', a5: 'A5', a3: 'A3' }[ps.size] || 'A4';
    const orient = ps.orientation === 'landscape' ? 'Landscape' : 'Portrait';
    const preset = ps.marginPreset === 'custom' ? 'Custom margins' : `${(CV_MARGIN_PRESETS[ps.marginPreset].label || '').split(' –')[0]} margins`;
    return `${sizeName} · ${orient} · ${preset}`;
  }

  // Makes the on-screen sheet match the real page: same size and margins as the PDF
  function applyPageSetupToSheet(sheet, ps) {
    if (!sheet) return;
    const g = getPageGeometry(ps);
    sheet.style.width = `${g.w}mm`;
    sheet.style.minHeight = `${g.h}mm`;
    sheet.style.padding = `${g.m.top}mm ${g.m.right}mm ${g.m.bottom}mm ${g.m.left}mm`;
  }

  // Dynamic @page rule for the browser Print dialog
  function applyPrintPageRule(ps) {
    const g = getPageGeometry(ps);
    let styleEl = document.getElementById('cvDynamicPageRule');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'cvDynamicPageRule';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      @media print {
        @page { size: ${g.w}mm ${g.h}mm; margin: ${g.m.top}mm ${g.m.right}mm ${g.m.bottom}mm ${g.m.left}mm; }
        #cvPrintArea .cv-a4-sheet {
          width: ${g.innerW}mm !important;
          max-width: ${g.innerW}mm !important;
          min-height: auto !important;
          padding: 0 !important;
        }
        #cvPrintArea .cv-sheet-footer { display: none !important; }
      }
    `;
  }

  function updatePageSetupBadge() {
    const badge = document.getElementById('cvPageSetupBadge');
    if (badge && currentCv) badge.textContent = describePageSetup(getCvPageSetup(currentCv));
  }

  // ---------- Page Setup dialog ----------
  window.openCvPageSetup = function (exportAfter) {
    if (!currentCv) return;
    readTopBarValues();
    const ps = getCvPageSetup(currentCv);

    let modal = document.getElementById('cvPageSetupModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'cvPageSetupModal';
      modal.className = 'modal hidden';
      modal.addEventListener('click', e => { if (e.target === modal) window.closeCvPageSetup(); });
      document.body.appendChild(modal);
    }

    const sizeOpts = Object.keys(CV_PAGE_SIZES).map(k =>
      `<option value="${k}" ${ps.size === k ? 'selected' : ''}>${CV_PAGE_SIZES[k].label}</option>`).join('');
    const presetOpts = Object.keys(CV_MARGIN_PRESETS).map(k =>
      `<option value="${k}" ${ps.marginPreset === k ? 'selected' : ''}>${CV_MARGIN_PRESETS[k].label}</option>`).join('');
    const marginInput = (k, label) => `
      <div class="cv-ps-margin">
        <label for="cvPsM_${k}">${label}</label>
        <div class="cv-ps-unit"><input type="number" id="cvPsM_${k}" min="${CV_MIN_MARGIN_MM}" max="${CV_MAX_MARGIN_MM}" step="0.1" value="${ps.margins[k]}" oninput="window.onCvPageSetupMarginInput()"><span>mm</span></div>
      </div>`;

    modal.innerHTML = `
      <div class="modal-content cv-page-setup-modal">
        <span class="close-btn" onclick="window.closeCvPageSetup()">&times;</span>
        <h3><i class="fas fa-file-pdf" style="color:#dc2626;"></i> PDF Page Setup</h3>
        <div class="cv-ps-grid">
          <div class="cv-ps-fields">
            <div class="cv-form-group">
              <label for="cvPsSize">Paper Size</label>
              <select id="cvPsSize" onchange="window.onCvPageSetupChange()">${sizeOpts}</select>
            </div>
            <div class="cv-form-group">
              <label>Orientation</label>
              <div class="cv-ps-orient">
                <label class="cv-ps-orient-opt"><input type="radio" name="cvPsOrient" value="portrait" ${ps.orientation === 'portrait' ? 'checked' : ''} onchange="window.onCvPageSetupChange()"><span><i class="far fa-file"></i> Portrait</span></label>
                <label class="cv-ps-orient-opt"><input type="radio" name="cvPsOrient" value="landscape" ${ps.orientation === 'landscape' ? 'checked' : ''} onchange="window.onCvPageSetupChange()"><span><i class="far fa-file" style="transform:rotate(90deg);"></i> Landscape</span></label>
              </div>
            </div>
            <div class="cv-form-group">
              <label for="cvPsPreset">Margins</label>
              <select id="cvPsPreset" onchange="window.onCvPageSetupPresetChange()">${presetOpts}</select>
            </div>
            <div class="cv-ps-margins">
              ${marginInput('top', 'Top')}${marginInput('bottom', 'Bottom')}${marginInput('left', 'Left')}${marginInput('right', 'Right')}
            </div>
            <label class="cv-ps-check"><input type="checkbox" id="cvPsFooter" ${ps.showFooter ? 'checked' : ''} onchange="window.onCvPageSetupChange()"> Show footer with name &amp; page numbers (inside bottom margin)</label>
            <label class="cv-ps-check"><input type="checkbox" id="cvPsSaveDefault"> Use these settings as my default for new CVs</label>
          </div>
          <div class="cv-ps-preview">
            <div id="cvPsPage" class="cv-ps-page"><div id="cvPsInner" class="cv-ps-inner"><span></span><span></span><span></span><span></span><span></span></div></div>
            <div id="cvPsInfo" class="cv-ps-info"></div>
          </div>
        </div>
        <div class="cv-ps-actions">
          <button class="btn secondary-btn small-btn" onclick="window.resetCvPageSetupForm()" title="A4 Portrait, Standard 20 mm margins"><i class="fas fa-rotate-left"></i> Reset to Standard</button>
          <div style="flex:1;"></div>
          <button class="btn secondary-btn small-btn" onclick="window.closeCvPageSetup()">Cancel</button>
          <button class="btn secondary-btn small-btn" onclick="window.applyCvPageSetup(false)"><i class="fas fa-check"></i> Apply</button>
          <button class="btn primary-btn small-btn" onclick="window.applyCvPageSetup(true)"><i class="fas fa-file-pdf"></i> Apply &amp; Export PDF</button>
        </div>
      </div>
    `;
    modal.classList.remove('hidden');
    refreshCvPageSetupPreview();
  };

  window.closeCvPageSetup = function () {
    const modal = document.getElementById('cvPageSetupModal');
    if (modal) modal.classList.add('hidden');
  };

  function readCvPageSetupForm() {
    const val = id => document.getElementById(id);
    const orient = document.querySelector('input[name="cvPsOrient"]:checked');
    return {
      size: val('cvPsSize') ? val('cvPsSize').value : 'a4',
      orientation: orient ? orient.value : 'portrait',
      marginPreset: val('cvPsPreset') ? val('cvPsPreset').value : 'standard',
      margins: {
        top: parseFloat(val('cvPsM_top')?.value),
        right: parseFloat(val('cvPsM_right')?.value),
        bottom: parseFloat(val('cvPsM_bottom')?.value),
        left: parseFloat(val('cvPsM_left')?.value)
      },
      showFooter: !!(val('cvPsFooter') && val('cvPsFooter').checked)
    };
  }

  function refreshCvPageSetupPreview() {
    const raw = readCvPageSetupForm();
    const ps = normalizePageSetup(raw);
    const g = getPageGeometry(ps);
    const page = document.getElementById('cvPsPage');
    const inner = document.getElementById('cvPsInner');
    const info = document.getElementById('cvPsInfo');
    if (page && inner) {
      const maxBox = 190;
      const scale = maxBox / Math.max(g.w, g.h);
      page.style.width = `${g.w * scale}px`;
      page.style.height = `${g.h * scale}px`;
      inner.style.top = `${g.m.top * scale}px`;
      inner.style.left = `${g.m.left * scale}px`;
      inner.style.right = `${g.m.right * scale}px`;
      inner.style.bottom = `${g.m.bottom * scale}px`;
    }
    if (info) {
      const notes = [];
      ['top', 'right', 'bottom', 'left'].forEach(k => {
        if (isFinite(raw.margins[k]) && Math.abs(raw.margins[k] - ps.margins[k]) > 0.05) {
          notes.push(`${k[0].toUpperCase() + k.slice(1)} margin adjusted to ${ps.margins[k]} mm`);
        }
      });
      info.innerHTML = `
        <div><strong>Page:</strong> ${g.w} × ${g.h} mm</div>
        <div><strong>Printable area:</strong> ${g.innerW} × ${g.innerH} mm</div>
        ${notes.length ? `<div class="cv-ps-warn"><i class="fas fa-circle-info"></i> ${notes.join('<br>')}</div>` : ''}
      `;
    }
  }

  window.onCvPageSetupChange = function () { refreshCvPageSetupPreview(); };

  window.onCvPageSetupPresetChange = function () {
    const key = document.getElementById('cvPsPreset')?.value;
    const preset = CV_MARGIN_PRESETS[key];
    if (preset && key !== 'custom') {
      ['top', 'right', 'bottom', 'left'].forEach(k => {
        const el = document.getElementById(`cvPsM_${k}`);
        if (el) el.value = preset[k];
      });
    }
    refreshCvPageSetupPreview();
  };

  window.onCvPageSetupMarginInput = function () {
    const sel = document.getElementById('cvPsPreset');
    if (sel) {
      const raw = readCvPageSetupForm().margins;
      const match = Object.keys(CV_MARGIN_PRESETS).find(k => k !== 'custom' &&
        ['top', 'right', 'bottom', 'left'].every(s => Math.abs(CV_MARGIN_PRESETS[k][s] - raw[s]) < 0.05));
      sel.value = match || 'custom';
    }
    refreshCvPageSetupPreview();
  };

  window.resetCvPageSetupForm = function () {
    const std = getStandardPageSetup();
    document.getElementById('cvPsSize').value = std.size;
    document.querySelectorAll('input[name="cvPsOrient"]').forEach(r => { r.checked = r.value === std.orientation; });
    document.getElementById('cvPsPreset').value = std.marginPreset;
    ['top', 'right', 'bottom', 'left'].forEach(k => { document.getElementById(`cvPsM_${k}`).value = std.margins[k]; });
    document.getElementById('cvPsFooter').checked = std.showFooter;
    refreshCvPageSetupPreview();
  };

  window.applyCvPageSetup = function (exportNow) {
    if (!currentCv) return;
    const ps = normalizePageSetup(readCvPageSetupForm());
    currentCv.pageSetup = ps;
    if (document.getElementById('cvPsSaveDefault')?.checked) {
      try { localStorage.setItem(CV_PAGE_SETUP_DEFAULT_KEY, JSON.stringify(ps)); } catch (e) { /* ignore */ }
    }
    window.closeCvPageSetup();
    updateLivePreview();
    showFloatingNotification(`Page setup: ${describePageSetup(ps)}`);
    if (exportNow) generatePdfForCv(currentCv);
  };

  // Sample data generator for new CVs
  function createDefaultCvData(title = 'Professional CV') {
    const userEmail = window.currentUser ? window.currentUser.email : '';
    const userName = window.currentUser && window.currentUser.displayName ? window.currentUser.displayName : 'Alex Morgan';

    return {
      id: 'cv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: title,
      visibility: 'private', // 'private' or 'public'
      template: 'modern', // 'modern', 'classic', 'minimal', 'ats', 'elegant', 'sidebar'
      autoSave: true, // Default auto-save ON for each newly created CV
      createdBy: userEmail,
      createdByName: userName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sectionsOrder: [...DEFAULT_SECTIONS_ORDER],
      hiddenSections: [],
      pageSetup: getUserDefaultPageSetup(), // A4 Portrait, Standard margins unless user changed default

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
          duration: '',
          reference: 'Dr. Evelyn Carter, VP of Engineering – e.carter@apexsolutions.com',
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
          duration: '',
          reference: '',
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
          location: 'Online',
          duration: '6 weeks',
          issueDate: '2023-08',
          expirationDate: '2026-08',
          credentialId: 'AWS-SAP-894102',
          url: 'https://aws.amazon.com/verify'
        },
        {
          id: 'cert_' + Math.random().toString(36).substr(2, 6),
          name: 'Project Management Professional (PMP)',
          organization: 'Project Management Institute (PMI)',
          location: 'San Francisco, CA',
          duration: '35 hours',
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
          duration: '',
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
          membershipNo: '94021873',
          period: '2020 - Present'
        },
        {
          id: 'mem_' + Math.random().toString(36).substr(2, 6),
          organization: 'Association for Computing Machinery (ACM)',
          role: 'Professional Member',
          membershipNo: '3812094',
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
        ats: 'Clean and Executive',
        elegant: 'Elegant Teal & Gold',
        sidebar: 'Navy Sidebar Executive'
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
              <div><i class="fas fa-user-pen" style="width: 14px; color: var(--gray-400);"></i> Created by: ${escapeHtml(cv.personal?.fullName || cv.createdByName || cv.createdBy || 'User')}</div>
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
  window.createNewCvPrompt = async function () {
    const title = typeof window.customPrompt === 'function'
      ? await window.customPrompt('Give your new CV a name. You can rename it anytime from the editor.', {
          title: 'Create New CV',
          label: 'CV Title',
          defaultValue: 'My Professional CV',
          placeholder: 'e.g. Network Engineer CV – 2026',
          confirmText: 'Create CV',
          icon: 'fas fa-file-circle-plus',
          requiredMessage: 'Please enter a title for your CV.',
          maxLength: 120
        })
      : prompt('Enter a title for your new CV:', 'My Professional CV');
    if (title === null) return;

    currentCv = createDefaultCvData(String(title).trim() || 'My Professional CV');
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
    const autoSaveSelect = document.getElementById('cvDocAutoSave');

    if (titleInput) titleInput.value = currentCv.title || 'Untitled CV';
    if (visSelect) visSelect.value = currentCv.visibility || 'private';
    if (tplSelect) tplSelect.value = currentCv.template || 'modern';
    if (autoSaveSelect) autoSaveSelect.value = currentCv.autoSave !== false ? 'on' : 'off';
    updateCvAutoSaveStatusUI();

    switchCvSubView('editor');
    renderSectionManager();
    renderAllSectionForms();
    updateLivePreview();
  }

  window.backToCvList = function () {
    if (cvAutoSaveTimer) clearTimeout(cvAutoSaveTimer);
    if (currentCv) {
      readTopBarValues();
      saveCvToStorage(currentCv);
    }
    switchCvSubView('list');
  };

  // Save current CV in app
  window.saveCurrentCvInApp = async function () {
    if (!currentCv) return;
    if (cvAutoSaveTimer) clearTimeout(cvAutoSaveTimer);
    readTopBarValues();
    await saveCvToStorage(currentCv);
    updateCvAutoSaveStatusUI('<span style="color:#10b981;"><i class="fas fa-check-circle"></i> Saved</span>');
    showFloatingNotification('CV saved successfully!');
    renderCvListView();
  };

  function readTopBarValues() {
    if (!currentCv) return;
    const title = document.getElementById('cvDocTitle')?.value?.trim();
    const visibility = document.getElementById('cvDocVisibility')?.value;
    const template = document.getElementById('cvDocTemplate')?.value;
    const autoSave = document.getElementById('cvDocAutoSave')?.value;

    if (title) currentCv.title = title;
    if (visibility) currentCv.visibility = visibility;
    if (template) currentCv.template = template;
    if (autoSave) currentCv.autoSave = (autoSave === 'on');
  }

  // ==========================================================================
  // Auto-Save Controller (Debounced while working, default ON)
  // ==========================================================================
  let cvAutoSaveTimer = null;
  let isCvAutoSaving = false;

  function updateCvAutoSaveStatusUI(customHtml) {
    const statusEl = document.getElementById('cvAutoSaveStatus');
    if (!statusEl) return;
    if (customHtml) {
      statusEl.innerHTML = customHtml;
      return;
    }
    if (currentCv && currentCv.autoSave === false) {
      statusEl.innerHTML = '<span style="color:var(--gray-400);"><i class="fas fa-pause-circle"></i> Off</span>';
    } else {
      statusEl.innerHTML = '<span style="color:var(--gray-500);"><i class="fas fa-check-circle" style="color:#10b981;"></i> On</span>';
    }
  }

  function triggerCvAutoSave() {
    if (!currentCv || currentCv.autoSave === false) return;

    updateCvAutoSaveStatusUI('<span style="color:var(--primary-600);"><i class="fas fa-circle-notch fa-spin"></i> Saving...</span>');

    if (cvAutoSaveTimer) clearTimeout(cvAutoSaveTimer);
    cvAutoSaveTimer = setTimeout(async () => {
      if (!currentCv || currentCv.autoSave === false || isCvAutoSaving) return;
      try {
        isCvAutoSaving = true;
        readTopBarValues();
        await saveCvToStorage(currentCv);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        updateCvAutoSaveStatusUI(`<span style="color:#10b981;" title="Auto-saved to cloud"><i class="fas fa-check-circle"></i> Saved ${timeStr}</span>`);
      } catch (err) {
        console.warn('CV auto-save error:', err);
        updateCvAutoSaveStatusUI('<span style="color:#ef4444;"><i class="fas fa-exclamation-triangle"></i> Save error</span>');
      } finally {
        isCvAutoSaving = false;
      }
    }, 1200);
  }

  window.onCvAutoSaveChange = function () {
    readTopBarValues();
    if (currentCv.autoSave === false) {
      if (cvAutoSaveTimer) clearTimeout(cvAutoSaveTimer);
      updateCvAutoSaveStatusUI();
    } else {
      triggerCvAutoSave();
    }
  };

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

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Duration</label>
              <input type="text" value="${escapeHtml(exp.duration || '')}" placeholder="${escapeHtml(computeDuration(exp.startDate, exp.current ? 'Present' : exp.endDate) ? 'Auto: ' + computeDuration(exp.startDate, exp.current ? 'Present' : exp.endDate) : 'e.g. 2 yrs 6 mos')}" oninput="window.updateExpField('${exp.id}', 'duration', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Reference</label>
              <input type="text" value="${escapeHtml(exp.reference || '')}" placeholder="e.g. Mr. Ram Sharma, Manager – ram@example.com, +977-98XXXXXXXX" oninput="window.updateExpField('${exp.id}', 'reference', this.value)">
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
      duration: '',
      reference: '',
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
            <div class="cv-item-box-title">#${index + 1}: ${escapeHtml(cert.name || 'Training')}</div>
            <div class="cv-item-box-tools">
              ${!isFirst ? `<button class="cv-chip-btn" onclick="window.moveCertItem(${index}, -1)" title="Move Up"><i class="fas fa-arrow-up"></i></button>` : ''}
              ${!isLast ? `<button class="cv-chip-btn" onclick="window.moveCertItem(${index}, 1)" title="Move Down"><i class="fas fa-arrow-down"></i></button>` : ''}
              <button class="cv-chip-btn" style="color:var(--danger-600);" onclick="window.deleteCertItem('${cert.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Training Name *</label>
              <input type="text" value="${escapeHtml(cert.name || '')}" placeholder="e.g. AWS Certified Solutions Architect" oninput="window.updateCertField('${cert.id}', 'name', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Issuing Organization *</label>
              <input type="text" value="${escapeHtml(cert.organization || '')}" placeholder="e.g. Amazon Web Services" oninput="window.updateCertField('${cert.id}', 'organization', this.value)">
            </div>
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Location</label>
              <input type="text" value="${escapeHtml(cert.location || '')}" placeholder="e.g. Kathmandu, Nepal / Online" oninput="window.updateCertField('${cert.id}', 'location', this.value)">
            </div>
            <div class="cv-form-group">
              <label>Duration</label>
              <input type="text" value="${escapeHtml(cert.duration || '')}" placeholder="e.g. 2 weeks / 40 hours / Jan–Mar 2024" oninput="window.updateCertField('${cert.id}', 'duration', this.value)">
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
      location: '',
      duration: '',
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
              <label>Duration</label>
              <input type="text" value="${escapeHtml(award.duration || '')}" placeholder="e.g. 2019 - 2023 / 4 years" oninput="window.updateAwardField('${award.id}', 'duration', this.value)">
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
      duration: '',
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
          </div>

          <div class="cv-form-row">
            <div class="cv-form-group">
              <label>Membership Number</label>
              <input type="text" value="${escapeHtml(mem.membershipNo || '')}" placeholder="e.g. NEC-12345 / 94021873" oninput="window.updateMemField('${mem.id}', 'membershipNo', this.value)">
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
      membershipNo: '',
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
    applyPageSetupToSheet(previewContainer.querySelector('.cv-a4-sheet'), getCvPageSetup(currentCv));
    updatePageSetupBadge();
    applyZoom();
    triggerCvAutoSave();
  }

  // Zoom controls
  window.cvZoomIn = function () {
    if (cvZoomLevel < 1.4) {
      cvZoomLevel = Math.round((cvZoomLevel + 0.1) * 10) / 10;
      applyZoom();
    }
  };

  window.cvZoomOut = function () {
    if (cvZoomLevel > 0.3) {
      cvZoomLevel = Math.round((cvZoomLevel - 0.1) * 10) / 10;
      applyZoom();
    }
  };

  window.cvZoomFit = function () {
    const scrollArea = document.querySelector('.cv-preview-scroll-area');
    if (scrollArea) {
      const areaWidth = scrollArea.clientWidth - 40;
      const sheet = document.querySelector('#cvLivePreviewArea .cv-a4-sheet');
      const sheetWidth = sheet ? sheet.offsetWidth : 800; // A4 portrait ≈ 794px
      const targetZoom = Math.min(1.0, Math.max(0.3, areaWidth / (sheetWidth + 6)));
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
        const durationStr = (exp.duration || '').trim() || computeDuration(exp.startDate, exp.current ? 'Present' : exp.endDate);
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
              <div class="cv-entry-date">${escapeHtml(dateStr)}${durationStr ? `<span class="cv-entry-duration">${escapeHtml(durationStr)}</span>` : ''}</div>
            </div>
            ${exp.location || exp.employmentType ? `
              <div class="cv-entry-location">
                ${exp.location ? escapeHtml(exp.location) : ''}
                ${exp.location && exp.employmentType ? ' &bull; ' : ''}
                ${exp.employmentType ? escapeHtml(exp.employmentType) : ''}
              </div>
            ` : ''}
            ${bulletsHtml ? `<ul class="cv-bullets">${bulletsHtml}</ul>` : ''}
            ${exp.reference && exp.reference.trim() ? `<div class="cv-entry-reference"><strong>Reference:</strong> ${escapeHtml(exp.reference)}</div>` : ''}
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
      const certsHtml = cv.certifications.map(cert => {
        const meta = [];
        if (cert.organization) meta.push(escapeHtml(cert.organization));
        if (cert.location) meta.push(`<i class="fas fa-map-marker-alt" style="font-size:7.5pt;"></i> ${escapeHtml(cert.location)}`);
        if (cert.duration && cert.issueDate) meta.push(`Completed: ${escapeHtml(cert.issueDate)}`);
        if (cert.credentialId) meta.push(`ID: ${escapeHtml(cert.credentialId)}`);
        if (cert.expirationDate) meta.push(`Expires: ${escapeHtml(cert.expirationDate)}`);
        return `
        <div class="cv-entry cv-avoid-break">
          <div class="cv-entry-header">
            <span class="cv-entry-title">${escapeHtml(cert.name || 'Training')}</span>
            <span class="cv-entry-date">${escapeHtml(cert.duration || cert.issueDate || '')}</span>
          </div>
          ${meta.length ? `<div class="cv-entry-meta" style="font-size:8.5pt;color:#555;">${meta.join(' &bull; ')}</div>` : ''}
        </div>
      `;
      }).join('');

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
      const awardsHtml = cv.awards.map(award => {
        const meta = [];
        if (award.issuer) meta.push(escapeHtml(award.issuer));
        if (award.duration && award.date) meta.push(`Awarded: ${escapeHtml(award.date)}`);
        if (award.description) meta.push(escapeHtml(award.description));
        return `
        <div class="cv-entry cv-avoid-break">
          <div class="cv-entry-header">
            <span class="cv-entry-title">${escapeHtml(award.title || '')}</span>
            <span class="cv-entry-date">${escapeHtml(award.duration || award.date || '')}</span>
          </div>
          ${meta.length ? `<div class="cv-entry-meta" style="font-size:8.5pt;color:#555;">${meta.join(' &bull; ')}</div>` : ''}
        </div>
      `;
      }).join('');

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
            ${mem.membershipNo ? `<div class="cv-entry-meta" style="font-size:8.5pt;color:#555;">Membership No: ${escapeHtml(mem.membershipNo)}</div>` : ''}
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
    if (templateKey === 'minimal' || templateKey === 'sidebar') {
      const leftSectionKeys = templateKey === 'sidebar'
        ? ['skills', 'languages', 'memberships', 'awards']
        : ['skills', 'languages', 'certifications', 'memberships', 'awards'];
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

    // Template 1 (Modern), 2 (Classic), 4 (ATS), 5 (Elegant Teal & Gold)
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

    // User page setup (defaults: A4 Portrait, Standard 20 mm margins)
    const ps = getCvPageSetup(cvData);
    const geo = getPageGeometry(ps);
    const m = geo.m;
    // Safety gutter (mm): the canvas is captured slightly wider than the text column and the
    // PDF margins are reduced by the same amount, so the text still sits exactly inside the
    // chosen margins, but glyphs that the canvas renderer draws a little wider than the
    // browser layout (common with Windows fonts on right-aligned dates) are no longer cut off.
    const G = Math.max(0, Math.min(4, Math.min(m.left, m.right) - 1));
    const captureW = Math.round((geo.innerW + 2 * G) * 10) / 10;

    // The content is laid out at exactly the printable width (page width minus left/right
    // margins), so nothing is scaled, shifted or cropped into the margins.
    const tempContainer = document.createElement('div');
    tempContainer.className = 'cv-pdf-export-host';
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = `${captureW}mm`;
    tempContainer.style.boxSizing = 'border-box';
    tempContainer.innerHTML = renderCvDocumentHtml(cvData, cvData.template || 'modern');
    document.body.appendChild(tempContainer);

    const sheet = tempContainer.querySelector('.cv-a4-sheet');
    if (sheet) {
      // html2pdf clones only this sheet, so PDF-specific CSS hooks onto a class on the sheet itself
      sheet.classList.add('cv-pdf-export');
      sheet.style.boxShadow = 'none';
      sheet.style.margin = '0';
      sheet.style.width = `${captureW}mm`;
      sheet.style.maxWidth = `${captureW}mm`;
      sheet.style.boxSizing = 'border-box';
      // Page margins are applied by jsPDF; the sheet only carries the side gutter, so the
      // text column is exactly the printable width chosen in Page Setup.
      sheet.style.padding = `0 ${G}mm`;
      sheet.style.minHeight = 'auto';
      sheet.style.overflow = 'visible';
    }

    // Remove the on-screen footer; a real footer is drawn inside the bottom margin of each page
    const footers = tempContainer.querySelectorAll('.cv-sheet-footer');
    footers.forEach(f => f.remove());

    const filename = `${sanitizeFilename(cvData.title || 'Curriculum_Vitae')}.pdf`;

    const cleanup = () => {
      if (tempContainer.parentNode) tempContainer.parentNode.removeChild(tempContainer);
    };

    if (window.html2pdf) {
      const opt = {
        // html2pdf margin order: [top, left, bottom, right] (mm)
        margin: [m.top, m.left - G, m.bottom, m.right - G],
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
        jsPDF: { unit: 'mm', format: ps.size, orientation: ps.orientation },
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
            '.cv-entry-reference',
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
          if (!ps.showFooter) return;
          const totalPages = pdf.internal.getNumberOfPages();
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          // Footer sits entirely inside the bottom margin, aligned with the side margins
          const footerY = pageHeight - Math.max(4, m.bottom * 0.42);
          const lineY = footerY - 3.2;
          const leftX = m.left;
          const rightX = pageWidth - m.right;
          const candidateName = (cvData.personal?.fullName || cvData.title || 'Curriculum Vitae').trim();
          const footerLabel = `${candidateName} • Curriculum Vitae`;

          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setDrawColor(210, 215, 222);
            pdf.setLineWidth(0.2);
            pdf.line(leftX, lineY, rightX, lineY);

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(115, 120, 130);
            pdf.text(footerLabel, leftX, footerY);
            const pageStr = totalPages > 1 ? `Page ${i} of ${totalPages}` : 'Curriculum Vitae';
            pdf.text(pageStr, rightX, footerY, { align: 'right' });
          }
        })
        .save()
        .then(() => {
          cleanup();
          showFloatingNotification(`PDF downloaded (${describePageSetup(ps)})`);
        }).catch(err => {
          console.error('PDF export error:', err);
          cleanup();
          window.triggerCvPrintPreviewFor(cvData);
        });
    } else {
      cleanup();
      window.triggerCvPrintPreviewFor(cvData);
    }
  }

  // Print fallback that honours the same page setup
  window.triggerCvPrintPreviewFor = function (cvData) {
    let printArea = document.getElementById('cvPrintArea');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'cvPrintArea';
      document.body.appendChild(printArea);
    }
    printArea.innerHTML = renderCvDocumentHtml(cvData, cvData.template || 'modern');
    applyPrintPageRule(getCvPageSetup(cvData));
    window.print();
  };

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
    const wordGeo = getPageGeometry(getCvPageSetup(cvData));
    const toPt = mm => (mm * 72 / 25.4).toFixed(1);
    const wordLandscape = wordGeo.w > wordGeo.h;

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
              const durationStr = (exp.duration || '').trim() || computeDuration(exp.startDate, exp.current ? 'Present' : exp.endDate);
              const bullets = (exp.responsibilities || []).filter(b => b.trim()).map(b => `
                <li class="bullet">${escapeHtml(b)}</li>
              `).join('');

              sectionsWordHtml += `
                <table class="item-table" width="100%">
                  <tr>
                    <td class="bold-title">${escapeHtml(exp.jobTitle || 'Role')} &bull; ${escapeHtml(exp.organization || '')}</td>
                    <td class="right-date">${dateStr}${durationStr ? `<br/>(${escapeHtml(durationStr)})` : ''}</td>
                  </tr>
                </table>
                <div class="sub-meta">${escapeHtml(exp.location || '')}${exp.location && exp.employmentType ? ' &bull; ' : ''}${escapeHtml(exp.employmentType || '')}</div>
                ${bullets ? `<ul class="bullet-list">${bullets}</ul>` : ''}
                ${exp.reference && exp.reference.trim() ? `<div class="sub-meta"><strong>Reference:</strong> ${escapeHtml(exp.reference)}</div>` : ''}
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
                    <td class="right-date">${escapeHtml(cert.duration || cert.issueDate || '')}</td>
                  </tr>
                </table>
                ${(() => {
                  const m = [];
                  if (cert.location) m.push(`Location: ${escapeHtml(cert.location)}`);
                  if (cert.duration && cert.issueDate) m.push(`Completed: ${escapeHtml(cert.issueDate)}`);
                  if (cert.credentialId) m.push(`Credential ID: ${escapeHtml(cert.credentialId)}`);
                  return m.length ? `<div class="sub-meta">${m.join(' &bull; ')}</div>` : '';
                })()}
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
                    <td class="right-date">${escapeHtml(award.duration || award.date || '')}</td>
                  </tr>
                </table>
                ${award.duration && award.date ? `<div class="sub-meta">Awarded: ${escapeHtml(award.date)}</div>` : ''}
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
                    <td class="bold-title">${escapeHtml(mem.organization || '')}${mem.role ? ` (${escapeHtml(mem.role)})` : ''}</td>
                    <td class="right-date">${escapeHtml(mem.period || '')}</td>
                  </tr>
                </table>
                ${mem.membershipNo ? `<div class="sub-meta">Membership No: ${escapeHtml(mem.membershipNo)}</div>` : ''}
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
            size: ${toPt(wordGeo.w)}pt ${toPt(wordGeo.h)}pt; /* from CV Page Setup */
            ${wordLandscape ? 'mso-page-orientation: landscape;' : ''}
            margin: ${toPt(wordGeo.m.top)}pt ${toPt(wordGeo.m.right)}pt ${toPt(wordGeo.m.bottom)}pt ${toPt(wordGeo.m.left)}pt;
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
    applyPrintPageRule(getCvPageSetup(currentCv));
    window.print();
  };

  // Delete CV
  window.deleteCvById = async function (cvId) {
    const cv = (window.cvsCache || []).find(c => c.id === cvId);
    if (!cv) return;
    const confirmFn = window.customConfirm || window.confirm;
    if (!await confirmFn(`Move "${cv.title || 'Untitled CV'}" to Trash? (You can restore it within 30 days)`)) {
      return;
    }
    const cvTitle = cv.title || cv.personal?.fullName || 'Untitled CV';
    if (typeof window.moveToTrash === 'function' && window.currentGroup) {
      try {
        await window.moveToTrash('cvs', cvId, 'cv', 'CV', cvTitle, cv);
        window.cvsCache = (window.cvsCache || []).filter(c => c.id !== cvId);
        saveLocalCVs(window.cvsCache);
        showFloatingNotification('CV moved to Trash.');
        renderCvListView();
        return;
      } catch (err) {
        console.warn('Could not move CV to trash in Firestore:', err);
      }
    }
    await deleteCvFromStorage(cvId);
    showFloatingNotification('CV deleted.');
    renderCvListView();
  };

  // ==========================================================================
  // Utilities
  // ==========================================================================
  // Computes a human-readable duration (e.g. "2 yrs 3 mos") from flexible date strings
  // such as "2021-03", "Mar 2021", "2021" or "Present". Returns '' when not parseable.
  function computeDuration(start, end) {
    const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    function parse(v) {
      if (!v) return null;
      const t = String(v).trim().toLowerCase();
      if (t === 'present' || t === 'current' || t === 'now') {
        const d = new Date();
        return { y: d.getFullYear(), m: d.getMonth() };
      }
      let mt = t.match(/^(\d{4})[-\/.](\d{1,2})/);
      if (mt) return { y: +mt[1], m: Math.min(11, Math.max(0, +mt[2] - 1)) };
      mt = t.match(/^(\d{1,2})[-\/.](\d{4})$/);
      if (mt) return { y: +mt[2], m: Math.min(11, Math.max(0, +mt[1] - 1)) };
      mt = t.match(/([a-z]{3})[a-z]*\.?\s*,?\s*(\d{4})/);
      if (mt && MONTHS.indexOf(mt[1]) >= 0) return { y: +mt[2], m: MONTHS.indexOf(mt[1]) };
      mt = t.match(/^(\d{4})$/);
      if (mt) return { y: +mt[1], m: 0 };
      return null;
    }
    const a = parse(start);
    const b = parse(end || 'Present');
    if (!a || !b) return '';
    const yearOnly = v => /^\s*\d{4}\s*$/.test(String(v || ''));
    if (yearOnly(start) && yearOnly(end)) {
      const y = b.y - a.y;
      return y > 0 ? `${y} yr${y > 1 ? 's' : ''}` : '';
    }
    let total = (b.y - a.y) * 12 + (b.m - a.m) + 1; // inclusive of start month
    if (total <= 0) return '';
    const yrs = Math.floor(total / 12);
    const mos = total % 12;
    const parts = [];
    if (yrs) parts.push(`${yrs} yr${yrs > 1 ? 's' : ''}`);
    if (mos) parts.push(`${mos} mo${mos > 1 ? 's' : ''}`);
    return parts.join(' ');
  }

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

    // Top bar inputs change triggers live preview update and auto-save
    ['cvDocTitle', 'cvDocVisibility', 'cvDocTemplate', 'cvDocAutoSave'].forEach(id => {
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
