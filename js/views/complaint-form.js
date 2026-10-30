/**
 * views/complaint-form.js
 * ---------------------------------------------------------------------------
 * The student's "Submit a complaint" screen. Two tabs:
 *   - College Maintenance Complaint
 *   - Hostel Maintenance Complaint
 * Both support a single attachment (image / video / PDF, max 10 MB) with a live
 * upload progress bar.
 *
 * Student details are pre-filled from the signed-in profile, but stay editable
 * so a student can report on behalf of a classmate if needed.
 */

import { el, icon, field, textInput, textarea, select, sectionCard } from '../ui.js';
import { DEPARTMENTS, YEARS, SECTIONS, HOSTELS, PRIORITIES, MAX_FILE_SIZE } from '../constants.js';
import { subscribeCategories } from '../categories.js';
import { submitComplaint } from '../complaints.js';
import { noticeBox } from './shared.js';
import { validateAttachment, formatBytes, friendlyAuthError, attachmentKind } from '../utils.js';
import { navigate } from '../router.js';

export function createComplaintForm(ctx) {
  const profile = ctx.profile;
  let categories = { College: [], Hostel: [] };
  let activeTab = 'College';
  let selectedFile = null;

  /* ------------------------------------------------------------- fields */

  const college = {
    studentName: textInput({ id: 'cName', value: profile.fullName || '', required: true }),
    registerNumber: textInput({ id: 'cReg', value: profile.regNo || '', required: true }),
    department: select({ id: 'cDept', options: DEPARTMENTS, value: profile.department || '', placeholder: 'Select department', required: true }),
    year: select({ id: 'cYear', options: YEARS, value: profile.year || '', placeholder: 'Select year', required: true }),
    section: select({ id: 'cSection', options: SECTIONS, value: profile.section || '', placeholder: 'Select section', required: true }),
    venue: textInput({ id: 'cVenue', placeholder: 'e.g. Main Block, 2nd floor', required: true }),
    roomNumber: textInput({ id: 'cRoom', placeholder: 'e.g. 204 or Lab 3' }),
    category: select({ id: 'cCategory', options: [], placeholder: 'Select category', required: true }),
    description: textarea({ id: 'cDesc', placeholder: 'Describe the problem, when it started and any safety risk.', required: true }),
    priority: select({ id: 'cPriority', options: PRIORITIES, value: 'Medium', required: true }),
  };

  const hostel = {
    studentName: textInput({ id: 'hName', value: profile.fullName || '', required: true }),
    registerNumber: textInput({ id: 'hReg', value: profile.regNo || '', required: true }),
    hostelName: select({ id: 'hHostel', options: HOSTELS, placeholder: 'Select hostel', required: true }),
    roomNumber: textInput({ id: 'hRoom', placeholder: 'e.g. 214', required: true }),
    floor: select({ id: 'hFloor', options: ['Ground floor', '1st floor', '2nd floor', '3rd floor', '4th floor'], placeholder: 'Select floor', required: true }),
    category: select({ id: 'hCategory', options: [], placeholder: 'Select category', required: true }),
    description: textarea({ id: 'hDesc', placeholder: 'Describe the problem, when it started and any safety risk.', required: true }),
    priority: select({ id: 'hPriority', options: PRIORITIES, value: 'Medium', required: true }),
  };

  /* -------------------------------------------------------- attachment UI */

  const fileInput = el('input', { type: 'file', accept: 'image/*,video/*,application/pdf' });
  const filePreview = el('div', { class: 'hidden' });
  const progressBar = el('div', { class: 'upload-track__bar' });
  const progressWrap = el('div', { class: 'upload-track hidden' }, progressBar);

  const dropZone = el('div', { class: 'file-drop', onclick: () => fileInput.click() },
    icon('upload', 22),
    el('div', { style: { fontWeight: '600', marginTop: '4px' } }, 'Click to attach an image, video or PDF'),
    el('div', { class: 'faint', text: `Maximum size ${formatBytes(MAX_FILE_SIZE)}` })
  );

  fileInput.addEventListener('change', () => {
    selectedFile = fileInput.files?.[0] || null;
    renderFilePreview();
  });

  function renderFilePreview() {
    if (!selectedFile) {
      filePreview.classList.add('hidden');
      filePreview.replaceChildren();
      progressWrap.classList.add('hidden');
      return;
    }
    const check = validateAttachment(selectedFile, {
      maxBytes: MAX_FILE_SIZE,
      allowedPrefixes: ['image/', 'video/'],
      allowedTypes: ['application/pdf'],
    });
    if (!check.ok) {
      ctx.toast(check.reason, 'error');
      selectedFile = null;
      fileInput.value = '';
      renderFilePreview();
      return;
    }
    const kind = attachmentKind(selectedFile.type);
    const thumb = kind === 'image'
      ? el('img', { class: 'file-preview__thumb', src: URL.createObjectURL(selectedFile), alt: '' })
      : el('div', { class: 'file-preview__thumb' }, icon('file', 22));

    filePreview.replaceChildren(
      el('div', { class: 'file-preview' },
        thumb,
        el('div', { class: 'grow' },
          el('div', { class: 'file-preview__name', text: selectedFile.name }),
          el('div', { class: 'faint', text: `${selectedFile.type || 'file'} • ${formatBytes(selectedFile.size)}` })
        ),
        el('button', {
          class: 'btn btn--ghost btn--sm', type: 'button',
          onclick: () => { selectedFile = null; fileInput.value = ''; renderFilePreview(); },
        }, icon('x', 14), 'Remove')
      )
    );
    filePreview.classList.remove('hidden');
  }

  /* ------------------------------------------------------------- layout */

  const collegeForm = el('form', { class: 'stack', novalidate: true },
    el('div', { class: 'grid-form grid-form--3' },
      field({ label: 'Student name', required: true, control: college.studentName, id: 'cName' }),
      field({ label: 'Register number', required: true, control: college.registerNumber, id: 'cReg' }),
      field({ label: 'Department', required: true, control: college.department, id: 'cDept' }),
      field({ label: 'Year', required: true, control: college.year, id: 'cYear' }),
      field({ label: 'Section', required: true, control: college.section, id: 'cSection' }),
      field({ label: 'Priority', required: true, control: college.priority, id: 'cPriority' })
    ),
    el('div', { class: 'grid-form' },
      field({ label: 'Location / Block', required: true, control: college.venue, id: 'cVenue', hint: 'Where exactly is the problem?' }),
      field({ label: 'Room number', control: college.roomNumber, id: 'cRoom' })
    ),
    field({ label: 'Complaint category', required: true, control: college.category, id: 'cCategory' }),
    field({ label: 'Complaint description', required: true, control: college.description, id: 'cDesc' }),
    el('button', { class: 'btn btn--primary', type: 'submit' }, icon('plus', 16), 'Submit college complaint')
  );

  const hostelForm = el('form', { class: 'stack', novalidate: true },
    el('div', { class: 'grid-form grid-form--3' },
      field({ label: 'Student name', required: true, control: hostel.studentName, id: 'hName' }),
      field({ label: 'Register number', required: true, control: hostel.registerNumber, id: 'hReg' }),
      field({ label: 'Hostel', required: true, control: hostel.hostelName, id: 'hHostel' })
    ),
    el('div', { class: 'grid-form grid-form--3' },
      field({ label: 'Room number', required: true, control: hostel.roomNumber, id: 'hRoom' }),
      field({ label: 'Floor', required: true, control: hostel.floor, id: 'hFloor' }),
      field({ label: 'Priority', required: true, control: hostel.priority, id: 'hPriority' })
    ),
    field({ label: 'Complaint category', required: true, control: hostel.category, id: 'hCategory' }),
    field({ label: 'Complaint description', required: true, control: hostel.description, id: 'hDesc' }),
    el('button', { class: 'btn btn--primary', type: 'submit' }, icon('plus', 16), 'Submit hostel complaint')
  );

  /**
   * One shared attachment picker for BOTH tabs.
   * A DOM node can only exist in one place, so keeping a single picker outside
   * the two forms avoids the "missing upload box" bug you get from sharing nodes.
   */
  const attachmentBox = el('div', { class: 'stack' },
    el('div', { class: 'field__label' }, 'Attachment (optional)'),
    dropZone,
    fileInput,
    filePreview,
    progressWrap
  );

  const tabs = el('div', { class: 'auth__tabs', style: { maxWidth: '420px' } },
    el('button', { class: 'auth__tab is-active', type: 'button', dataset: { tab: 'College' }, onclick: () => setTab('College') }, 'College maintenance'),
    el('button', { class: 'auth__tab', type: 'button', dataset: { tab: 'Hostel' }, onclick: () => setTab('Hostel') }, 'Hostel maintenance')
  );

  const formSlot = el('div', {}, collegeForm);
  const hostelNotice = noticeBox('Hostel complaints are visible only to the Hostel Admin of the selected hostel.', 'info');

  function setTab(tab) {
    activeTab = tab;
    tabs.querySelectorAll('.auth__tab').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.tab === tab);
    });
    formSlot.replaceChildren(tab === 'College' ? collegeForm : hostelForm);
  }

  /* ------------------------------------------------------------ submit */

  async function handleSubmit(event, kind) {
    event.preventDefault();
    const f = kind === 'College' ? college : hostel;

    const payload = {
      complaintType: kind,
      studentName: f.studentName.value.trim(),
      registerNumber: f.registerNumber.value.trim(),
      category: f.category.value,
      description: f.description.value.trim(),
      priority: f.priority.value,
    };
    if (kind === 'College') {
      payload.department = f.department.value;
      payload.year = f.year.value;
      payload.section = f.section.value;
      payload.venue = f.venue.value.trim();
      payload.roomNumber = f.roomNumber.value.trim();
    } else {
      payload.hostelName = f.hostelName.value;
      payload.roomNumber = f.roomNumber.value.trim();
      payload.floor = f.floor.value;
    }

    const missing = Object.entries(payload).filter(([, value]) => !value).map(([key]) => key);
    if (missing.length) return ctx.toast('Please fill in all required fields.', 'error');
    if (payload.description.length < 10) return ctx.toast('Please describe the problem in at least 10 characters.', 'error');

    const submitButton = event.submitter || event.target.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const result = await submitComplaint(ctx.profile, payload, selectedFile, (percent) => {
        progressWrap.classList.remove('hidden');
        progressBar.style.width = `${percent}%`;
      });

      ctx.toast(`Complaint submitted. Your complaint ID is ${result.complaintCode}.`, 'success', 8000);
      selectedFile = null;
      fileInput.value = '';
      renderFilePreview();
      progressBar.style.width = '0%';
      progressWrap.classList.add('hidden');
      event.target.reset();
      // Re-apply profile pre-fill after reset
      if (kind === 'College') {
        college.studentName.value = profile.fullName || '';
        college.registerNumber.value = profile.regNo || '';
        college.priority.value = 'Medium';
      } else {
        hostel.studentName.value = profile.fullName || '';
        hostel.registerNumber.value = profile.regNo || '';
        hostel.priority.value = 'Medium';
      }
      navigate(`/complaints/${result.id}`);
    } catch (error) {
      progressWrap.classList.add('hidden');
      ctx.toast(friendlyAuthError(error), 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  collegeForm.addEventListener('submit', (event) => handleSubmit(event, 'College'));
  hostelForm.addEventListener('submit', (event) => handleSubmit(event, 'Hostel'));

  /* --------------------------------------------------------- categories */

  const unsubCategories = subscribeCategories((merged) => {
    categories = merged;
    const collegeCurrent = college.category.value;
    const hostelCurrent = hostel.category.value;
    fillSelect(college.category, merged.College, collegeCurrent);
    fillSelect(hostel.category, merged.Hostel, hostelCurrent);
  }, () => {});

  function fillSelect(node, names, current) {
    node.replaceChildren(
      el('option', { value: '', disabled: true, selected: !current }, 'Select category'),
      ...names.map((name) => el('option', { value: name, selected: name === current }, name))
    );
  }

  const panel = sectionCard({
    title: 'Submit a maintenance complaint',
    subtitle: 'Choose the campus type, fill in the details and attach a photo if you can — it helps the technician.',
    iconName: 'plus',
    body: el('div', { class: 'stack' }, tabs, formSlot, attachmentBox, hostelNotice),
  });

  return {
    element: panel,
    destroy() {
      unsubCategories();
    },
  };
}
