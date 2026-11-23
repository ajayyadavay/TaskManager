# Task Manager - Group Collaboration App

A modern, professional task management web application built with Firebase Firestore and Firebase Authentication, designed for seamless team collaboration with strong data isolation between groups.

## Key Features

### Authentication & Group Management
- **Secure Google Login**: All authentication handled by Firebase
- **Group Selection**: After login, users see all groups they're a member of, with role displayed (Admin/Member)
- **Group Creation**: New users can create new groups and become admin
- **Change Groups**: Users can switch between groups from the user profile dropdown

### Task Management
- **Task Creation**: Admin creates tasks with unique IDs, descriptions, primary/secondary users, and duration
- **Deadline Calculation**: Deadline calculated automatically from assignment date + duration
- **Accept/Reject Tasks**: Primary and secondary users can accept or reject tasks
- **Progress Updates**: Secondary users update progress with status (Work in Progress, Partially Completed, Completed)
- **Primary Verification**: Primary users verify progress before it's visible to admin
- **Close Tasks**: Admin closes tasks when verified and completed
- **Task Trail**: Complete audit history of all task activities

### Issue Reporting
- **Issue Creation**: Users can report issues with description, source, mitigation suggestions, and remarks
- **Convert to Task**: Admin can convert issues to tasks with one click (auto-fills description with issue details)
- **Issue Status Tracking**: Track issues as Open or Converted

### Curriculum Vitae (CV) Builder
- **New CV Menu**: Create, manage, and edit multi-page professional CVs within your group workspace
- **Visibility Control**: Set visibility to **Private** (creator only) or **Public** (group members) conforming to app rules
- **Multiple Formats & Templates**: Choose from 4 distinct aesthetics:
  - *Modern Professional*: Sleek typography, primary accents, colored headers, skill badge pills
  - *Classic Academic & Traditional*: Refined serif styling, formal rules, publication citations
  - *Two-Column Minimalist*: Structured dual-column layout separating skills/contact from experience
  - *Clean and Executive*: High-contrast, clean bullet structure optimized for scanning
- **12 Comprehensive Sections**:
  - Personal Information
  - Professional Summary
  - Work Experience (with multiple responsibility bullet points and easy reordering)
  - Education (degree, institution, location, duration, grade, remarks)
  - Technical Skills (categorized, custom categories, individual skill management)
  - Certifications and Training
  - Research and Publications
  - Scholarships and Awards
  - Projects (with multiple highlights)
  - Professional Memberships
  - Languages (with proficiency scale)
  - References ("Available upon request" or full contact cards)
- **Reorder & Hide Sections**: Move sections up/down and toggle visibility of any section with one click
- **Storage & File I/O**:
  - Save in App (Firestore group collection with local fallback)
  - Save as `*.cv` format (portable JSON)
  - Load from `*.cv` file
  - Export to crisp, multi-page **A4 PDF**
  - Export to **MS Word** (`.doc`) with native styling and clean tables
- **Interactive Live Preview**:
  - True A4 proportions (210mm x 297mm)
  - Instant reactive updates on every keystroke
  - Zoom controls (50%, 75%, 100%, 125%, Fit Width)
  - Page break management (prevents orphan headers and broken bullet points)
  - Dedicated Print Preview

### Dashboard & Search
- **Comprehensive Dashboard**: Shows statistics for tasks and issues
- **Powerful Search/Filter**: 
  - Text search (partial match on task/issue ID, description, etc.)
  - Filter by status
  - Filter by user (primary/secondary/reported by)
  - Filter by date
- **Modern UI**: Light, professional design with clear card-based layout

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Google Authentication** in the Authentication section
4. Enable **Cloud Firestore** in the Firestore Database section
5. Create a Web App to get your Firebase config

### 2. Configure Firebase

Open `app.js` and replace the `firebaseConfig` object with your Firebase project credentials:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 3. Set Up Firestore Security Rules

First, to create your first group, use these **very open temporary rules** (go to Firestore Database > Rules):

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // TEMPORARY: Allow all authenticated users to do anything (remove after your group is created!)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Important**: After creating your first group and inviting users, secure your data with these rules:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /groups/{groupId} {
      allow read: if isMemberOfGroup(groupId);
      allow write: if isAdminOfGroup(groupId);
      
      match /users/{userId} {
        allow read: if isMemberOfGroup(groupId);
        allow write: if isAdminOfGroup(groupId);
      }
      
      match /tasks/{taskId} {
        allow read: if isMemberOfGroup(groupId);
        allow create: if isAdminOfGroup(groupId);
        allow update: if isMemberOfGroup(groupId);
      }
      
      match /issues/{issueId} {
        allow read: if isMemberOfGroup(groupId);
        allow create: if isMemberOfGroup(groupId);
        allow update: if isAdminOfGroup(groupId);
      }
    }
  }
  
  function isMemberOfGroup(groupId) {
    return exists(/databases/$(database)/documents/groups/$(groupId)/users/$(request.auth.token.email));
  }
  
  function isAdminOfGroup(groupId) {
    return get(/databases/$(database)/documents/groups/$(groupId)/users/$(request.auth.token.email)).data.isAdmin == true;
  }
}
```

### 4. Run the App

Open `index.html` in your browser or serve it using a local web server (like VS Code's Live Server or Python's `http.server`).

## Usage Workflow

### 1. Getting Started
- Create a new group or select an existing one
- Admin invites team members to the group
- Users join by logging in with Google

### 2. Task Workflow
1. **Admin** creates a task, assigns primary and optionally secondary users
2. **Primary/Secondary Users** accept or reject the task
3. **Secondary User** updates task progress
4. **Primary User** verifies progress (only verified progress is visible to admin)
5. **Admin** closes the task when complete

### 3. Issue Workflow
1. Any user reports an issue
2. Admin reviews and converts to task if needed

## Project Structure

```
TASK/
├── index.html      # Main HTML file with all UI components
├── styles.css      # Modern, responsive stylesheet
├── app.js          # Complete Firebase & application logic
└── README.md      # This file
```

## Technologies Used
- HTML5
- CSS3
- Vanilla JavaScript
- Firebase Authentication
- Firebase Firestore
- Google Sign-In
