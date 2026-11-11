/**
 * Barangay Health Center Survey Management System
 * Shared client-side behavior.
 *
 * Build: v5 - modal forms clear on close (opt out with data-keep-on-close)
 */

document.addEventListener('DOMContentLoaded', function () {

    // ---------- Clearing modal forms ----------
    // Modals are only hidden with a CSS class, never removed from the page,
    // so anything typed into them survives a close. Every overlay is cleared
    // when dismissed and again when reopened. Add data-keep-on-close to an
    // overlay (e.g. a future "edit" modal pre-filled with a record) to skip it.
    function clearFields(overlay) {
        if (!overlay || overlay.hasAttribute('data-keep-on-close')) {
            return;
        }

        overlay.querySelectorAll('input, select, textarea').forEach(function (field) {
            var type = (field.getAttribute('type') || '').toLowerCase();

            // Leave hidden inputs alone - they carry the action flags
            // (add_resident, resident_id) the POST handler depends on
            if (type === 'hidden' || type === 'submit' || type === 'button') {
                return;
            }

            if (type === 'checkbox' || type === 'radio') {
                field.checked = field.defaultChecked;
            } else if (field.tagName === 'SELECT') {
                field.selectedIndex = 0;
                field.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                field.value = '';
                // Let listeners (e.g. the birthdate -> age calculator)
                // react to the field being emptied
                field.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        // Drop any server-rendered validation message so a reopened
        // blank form is not sitting under a stale red banner
        overlay.querySelectorAll('.alert').forEach(function (alertBox) {
            alertBox.remove();
        });
    }

    function openModal(overlay) {
        if (!overlay) { return; }
        clearFields(overlay);

        if (overlay.id === 'request-change-modal' && overlay.getAttribute('data-pending-request') === '1') {
            var warningBox = overlay.querySelector('.request-pending-warning');
            if (!warningBox) {
                warningBox = document.createElement('div');
                warningBox.className = 'alert alert-error request-pending-warning';
                warningBox.textContent = 'You already have a pending name/address request under review.';
                var heading = overlay.querySelector('h2');
                if (heading && heading.nextSibling) {
                    heading.parentNode.insertBefore(warningBox, heading.nextSibling);
                } else {
                    overlay.querySelector('.modal-box').insertBefore(warningBox, overlay.querySelector('.modal-box').firstChild.nextSibling);
                }
            }
            warningBox.style.display = 'block';
        }

        overlay.classList.add('active');
    }

    function closeModal(overlay) {
        if (!overlay) { return; }
        overlay.classList.remove('active');
        clearFields(overlay);
    }

    function createToastContainer() {
        var existing = document.getElementById('toast-container');
        if (existing) {
            return existing;
        }
        var container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
        return container;
    }

    function removeToast(toast) {
        if (!toast || !toast.parentNode) { return; }
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(16px)';
        window.setTimeout(function () {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 220);
    }

    function renderAlertToast(alert) {
        if (alert.closest('.modal-overlay')) { return; }
        var parent = alert.parentElement;
        if (!parent) { return; }

        var isTopLevelToast = parent.classList.contains('container')
            || (parent.classList.contains('card') && alert === parent.firstElementChild)
            || (parent.classList.contains('grid-2') && alert === parent.firstElementChild);
        if (!isTopLevelToast) { return; }

        var container = createToastContainer();
        var toast = document.createElement('div');
        toast.className = 'toast ' + (alert.classList.contains('alert-success') ? 'toast-success' : 'toast-error');
        toast.innerHTML = '<div class="toast-message">' + alert.innerHTML + '</div>';

        container.appendChild(toast);
        window.setTimeout(function () {
            removeToast(toast);
        }, 6000);

        alert.remove();
    }

    function initToasts() {
        document.querySelectorAll('.alert.alert-success, .alert.alert-error').forEach(function (alert) {
            renderAlertToast(alert);
        });
    }

    initToasts();

    // A form-backed confirmation remembers which form to send when the user
    // presses "Yes, Continue" in the shared modal.
    var pendingConfirmForm = null;
    var pendingConfirmTrigger = null;

    /**
     * Submits the form behind a confirmation.
     *
     * If the trigger button carried a name, its value is posted too - some
     * handlers branch on which button was pressed, and a scripted submit()
     * would otherwise drop it.
     */
    function submitConfirmedForm(form, trigger) {
        if (!form) { return; }
        if (trigger && trigger.name) {
            var carried = document.createElement('input');
            carried.type = 'hidden';
            carried.name = trigger.name;
            carried.value = trigger.value || '';
            form.appendChild(carried);
        }
        // Skip the unsaved-changes guard: this submit IS the user's decision.
        form.setAttribute('data-confirmed-submit', '1');
        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
        } else {
            form.submit();
        }
    }

    // ---------- Delegated click handling ----------
    // Bound to document rather than to each element, so it keeps working
    // for markup added after page load.
    document.addEventListener('click', function (e) {
        if (!e.target || typeof e.target.closest !== 'function') { return; }

        // Confirm before destructive actions (deactivate/delete/reset)
        var confirmEl = e.target.closest('[data-confirm]');
        if (confirmEl) {
            e.preventDefault();
            var confirmModal = document.getElementById('confirm-modal');
            var confirmMessage = document.getElementById('confirm-modal-message');
            var confirmProceed = document.getElementById('confirm-modal-proceed');

            // Two kinds of trigger: a link that navigates, or a submit button
            // inside a form. Remove Photo is the second kind, and the modal
            // used to handle only the first - so "Yes, Continue" led nowhere.
            var ownerForm = (confirmEl.form || confirmEl.closest('form')) || null;
            var isFormTrigger = !confirmEl.getAttribute('href') && ownerForm;

            if (!confirmModal || !confirmProceed) {
                // Fallback if the shared confirm modal isn't present on this page
                if (window.confirm(confirmEl.getAttribute('data-confirm'))) {
                    if (isFormTrigger) {
                        submitConfirmedForm(ownerForm, confirmEl);
                    } else {
                        window.location.href = confirmEl.getAttribute('href');
                    }
                }
                return;
            }
            if (confirmMessage) {
                confirmMessage.textContent = confirmEl.getAttribute('data-confirm');
            }

            if (isFormTrigger) {
                pendingConfirmForm = ownerForm;
                pendingConfirmTrigger = confirmEl;
                confirmProceed.setAttribute('href', '#');
            } else {
                pendingConfirmForm = null;
                pendingConfirmTrigger = null;
                confirmProceed.setAttribute('href', confirmEl.getAttribute('href') || '#');
            }

            confirmModal.classList.add('active');
            return;
        }

        // "Yes, Continue" for a form-backed confirmation.
        if (pendingConfirmForm && e.target.closest('#confirm-modal-proceed')) {
            e.preventDefault();
            var formToSubmit = pendingConfirmForm;
            var trigger = pendingConfirmTrigger;
            pendingConfirmForm = null;
            pendingConfirmTrigger = null;
            submitConfirmedForm(formToSubmit, trigger);
            return;
        }

        var closer = e.target.closest('[data-modal-close]');
        if (closer) {
            closeModal(closer.closest('.modal-overlay'));
            return;
        }

        var opener = e.target.closest('[data-modal-open]');
        if (opener) {
            openModal(document.getElementById(opener.getAttribute('data-modal-open')));
            return;
        }

        // Clicking the dark backdrop, but not the modal box itself
        if (e.target.classList && e.target.classList.contains('modal-overlay')) {
            closeModal(e.target);
        }
    });

    // Close the topmost modal on Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(function (overlay) {
                closeModal(overlay);
            });
        }
    });

    // ---------- Survey builder ----------
    // Toggle extra fields (e.g. choices) based on selected question type
    document.querySelectorAll('.question-type-select').forEach(function (select) {
        select.addEventListener('change', function () {
            var row = select.closest('.question-row');
            if (!row) { return; }
            var choicesBox = row.querySelector('.choices-box');
            if (choicesBox) {
                choicesBox.style.display = (select.value === 'multiple_choice') ? 'block' : 'none';
            }
        });
        select.dispatchEvent(new Event('change'));
    });


    // ---------- Survey answering ----------
    // Simple client-side required-field check for survey answer forms
    var surveyForm = document.getElementById('survey-answer-form');
    if (surveyForm) {
        surveyForm.addEventListener('submit', function (e) {
            var valid = true;
            surveyForm.querySelectorAll('[data-required-group]').forEach(function (group) {
                var name = group.dataset.requiredGroup;
                var checked = surveyForm.querySelector('input[name="' + name + '"]:checked');
                var textInput = surveyForm.querySelector('textarea[name="' + name + '"], input[type=text][name="' + name + '"]');
                if (!checked && textInput === null) {
                    valid = false;
                    group.classList.add('missing');
                } else {
                    group.classList.remove('missing');
                }
            });
            if (!valid) {
                e.preventDefault();
                alert('Please answer all required questions before submitting.');
            }
        });
    }

    var selectProfilePhotoBtn = document.getElementById('select-profile-photo-btn');
    var profilePhotoInput = document.getElementById('profile_photo');
    var photoConfirmModal = document.getElementById('photo-confirm-modal');
    var photoPreviewImage = document.getElementById('photo-preview-image');
    var photoCropCanvas = document.getElementById('photo-crop-canvas');
    var photoCropper = document.getElementById('photo-cropper');
    var photoZoom = document.getElementById('photo-zoom');
    var photoConfirmButton = document.getElementById('photo-confirm-btn');
    var photoChooseAnotherButton = document.getElementById('photo-choose-another-btn');
    var photoUploadForm = document.getElementById('photo-upload-form');

    if (selectProfilePhotoBtn && profilePhotoInput && photoConfirmModal && photoPreviewImage && photoCropCanvas && photoCropper && photoZoom && photoConfirmButton && photoChooseAnotherButton && photoUploadForm) {
        var cropCtx = photoCropCanvas.getContext('2d', { alpha: false });
        var cropImage = new Image();
        var cropObjectUrl = '';
        var cropState = {
            baseScale: 1,
            zoom: 1,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            dragging: false,
            startX: 0,
            startY: 0,
            originX: 0,
            originY: 0
        };

        function clampCropPosition() {
            var canvasSize = photoCropCanvas.width;
            var minX = Math.min(0, canvasSize - cropState.width);
            var minY = Math.min(0, canvasSize - cropState.height);
            cropState.x = Math.min(0, Math.max(minX, cropState.x));
            cropState.y = Math.min(0, Math.max(minY, cropState.y));
        }

        function renderCrop() {
            if (!cropImage.naturalWidth || !cropImage.naturalHeight) return;
            var size = photoCropCanvas.width;
            cropCtx.clearRect(0, 0, size, size);
            cropCtx.fillStyle = '#102d35';
            cropCtx.fillRect(0, 0, size, size);
            cropCtx.imageSmoothingEnabled = true;
            cropCtx.imageSmoothingQuality = 'high';
            cropCtx.drawImage(cropImage, cropState.x, cropState.y, cropState.width, cropState.height);

            var previewUrl = photoCropCanvas.toDataURL('image/jpeg', 0.9);
            photoPreviewImage.src = previewUrl;
        }

        function resetCropper() {
            if (!cropImage.naturalWidth || !cropImage.naturalHeight) return;
            var size = photoCropCanvas.width;
            cropState.baseScale = Math.max(size / cropImage.naturalWidth, size / cropImage.naturalHeight);
            cropState.zoom = 1;
            photoZoom.value = '1';
            cropState.width = cropImage.naturalWidth * cropState.baseScale;
            cropState.height = cropImage.naturalHeight * cropState.baseScale;
            cropState.x = (size - cropState.width) / 2;
            cropState.y = (size - cropState.height) / 2;
            clampCropPosition();
            renderCrop();
        }

        function setZoom(value) {
            if (!cropImage.naturalWidth) return;
            var oldWidth = cropState.width;
            var oldHeight = cropState.height;
            var centerX = (photoCropCanvas.width / 2 - cropState.x) / oldWidth;
            var centerY = (photoCropCanvas.height / 2 - cropState.y) / oldHeight;
            cropState.zoom = Number(value);
            cropState.width = cropImage.naturalWidth * cropState.baseScale * cropState.zoom;
            cropState.height = cropImage.naturalHeight * cropState.baseScale * cropState.zoom;
            cropState.x = photoCropCanvas.width / 2 - cropState.width * centerX;
            cropState.y = photoCropCanvas.height / 2 - cropState.height * centerY;
            clampCropPosition();
            renderCrop();
        }

        function openCropper(file) {
            if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
            cropObjectUrl = URL.createObjectURL(file);
            cropImage.onload = function () {
                resetCropper();
                openModal(photoConfirmModal);
            };
            cropImage.onerror = function () {
                alert('Unable to read that image. Please choose another photo.');
                profilePhotoInput.value = '';
            };
            cropImage.src = cropObjectUrl;
        }

        function pointerPosition(event) {
            var rect = photoCropCanvas.getBoundingClientRect();
            return {
                x: (event.clientX - rect.left) * (photoCropCanvas.width / rect.width),
                y: (event.clientY - rect.top) * (photoCropCanvas.height / rect.height)
            };
        }

        profilePhotoInput.addEventListener('change', function () {
            var file = profilePhotoInput.files && profilePhotoInput.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                alert('Please select a valid image file.');
                profilePhotoInput.value = '';
                return;
            }
            openCropper(file);
        });

        photoZoom.addEventListener('input', function () {
            setZoom(this.value);
        });

        photoCropCanvas.addEventListener('pointerdown', function (event) {
            if (!cropImage.naturalWidth) return;
            var point = pointerPosition(event);
            cropState.dragging = true;
            cropState.startX = point.x;
            cropState.startY = point.y;
            cropState.originX = cropState.x;
            cropState.originY = cropState.y;
            photoCropper.classList.add('is-dragging');
            photoCropCanvas.setPointerCapture(event.pointerId);
        });

        photoCropCanvas.addEventListener('pointermove', function (event) {
            if (!cropState.dragging) return;
            var point = pointerPosition(event);
            cropState.x = cropState.originX + (point.x - cropState.startX);
            cropState.y = cropState.originY + (point.y - cropState.startY);
            clampCropPosition();
            renderCrop();
        });

        function endCropDrag(event) {
            cropState.dragging = false;
            photoCropper.classList.remove('is-dragging');
            try { photoCropCanvas.releasePointerCapture(event.pointerId); } catch (ignore) {}
        }
        photoCropCanvas.addEventListener('pointerup', endCropDrag);
        photoCropCanvas.addEventListener('pointercancel', endCropDrag);
        photoCropCanvas.addEventListener('pointerleave', function () {
            if (cropState.dragging) renderCrop();
        });

        photoChooseAnotherButton.addEventListener('click', function () {
            photoPreviewImage.src = '';
            photoConfirmModal.classList.remove('active');
            profilePhotoInput.value = '';
            setTimeout(function () { profilePhotoInput.click(); }, 120);
        });

        photoConfirmButton.addEventListener('click', function () {
            if (!cropImage.naturalWidth || !profilePhotoInput.files.length) return;
            photoConfirmButton.disabled = true;
            photoConfirmButton.textContent = 'Preparing...';

            photoCropCanvas.toBlob(function (blob) {
                if (!blob) {
                    photoConfirmButton.disabled = false;
                    photoConfirmButton.textContent = 'Confirm & Upload';
                    alert('Unable to prepare the resized photo. Please try again.');
                    return;
                }
                try {
                    var croppedFile = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });
                    var transfer = new DataTransfer();
                    transfer.items.add(croppedFile);
                    profilePhotoInput.files = transfer.files;
                    photoUploadForm.submit();
                } catch (error) {
                    photoConfirmButton.disabled = false;
                    photoConfirmButton.textContent = 'Confirm & Upload';
                    alert('Your browser could not prepare the resized photo. Please try another browser or image.');
                }
            }, 'image/jpeg', 0.9);
        });
    }

    var residencyStatusSelects = document.querySelectorAll('.confirm-residency-change');
    residencyStatusSelects.forEach(function (select) {
        select.addEventListener('focus', function () {
            this.dataset.previousValue = this.value;
        });

        select.addEventListener('change', function () {
            var previous = this.dataset.previousValue || this.querySelector('option[selected]')?.value || this.value;
            var newValue = this.value;
            if (previous === newValue) {
                return;
            }
            var confirmed = window.confirm('Are you sure you want to change residency status to "' + newValue + '"?');
            if (confirmed) {
                this.form.submit();
            } else {
                this.value = previous;
            }
        });
    });

    // ---------- Responsive navigation drawer ----------
    var mobileNavToggle = document.getElementById('mobile-nav-toggle');
    var mobileSidebar = document.getElementById('app-sidebar') || document.querySelector('.sidebar');
    var mobileNavClose = document.querySelector('.mobile-nav-close');
    var mobileNavBackdrop = document.getElementById('nav-drawer-backdrop');

    function setNavOpen(open) {
        if (!mobileSidebar) { return; }
        mobileSidebar.classList.toggle('mobile-open', open);
        document.body.classList.toggle('nav-open', open);
        if (mobileNavBackdrop) {
            mobileNavBackdrop.classList.toggle('active', open);
            mobileNavBackdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
        }
        if (mobileNavToggle) {
            mobileNavToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            mobileNavToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        }
    }

    if (mobileNavToggle && mobileSidebar) {
        mobileNavToggle.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            setNavOpen(!mobileSidebar.classList.contains('mobile-open'));
        });

        if (mobileNavClose) {
            mobileNavClose.addEventListener('click', function (e) {
                e.preventDefault();
                setNavOpen(false);
                mobileNavToggle.focus();
            });
        }

        if (mobileNavBackdrop) {
            mobileNavBackdrop.addEventListener('click', function () {
                setNavOpen(false);
            });
        }

        mobileSidebar.querySelectorAll('a.nav-item').forEach(function (item) {
            item.addEventListener('click', function () { setNavOpen(false); });
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && mobileSidebar.classList.contains('mobile-open')) {
                setNavOpen(false);
                mobileNavToggle.focus();
            }
        });

        window.addEventListener('resize', function () {
            if (window.innerWidth > 1100) {
                setNavOpen(false);
            }
        });
    }

    // ---------- Account tab (upper-right corner) ----------
    // Opens the portal / logout menu and closes it on outside click or Escape.
    var accountChip = document.getElementById('account-chip');
    var accountMenu = document.getElementById('account-menu');
    if (accountChip && accountMenu) {
        accountChip.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = accountMenu.classList.toggle('open');
            accountChip.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        document.addEventListener('click', function (e) {
            if (!accountMenu.contains(e.target) && e.target !== accountChip) {
                accountMenu.classList.remove('open');
                accountChip.setAttribute('aria-expanded', 'false');
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                accountMenu.classList.remove('open');
                accountChip.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // ---------- Table search + filter tabs ----------
    // A search box declares data-table-search="<table id>"; each body row it
    // should look at carries data-search-text. Filter buttons declare
    // data-filter-group="<table id>" and data-filter="<value>", matched
    // against each row's data-filter attribute ("all" always matches).
    function filterTable(tableId) {
        var table = document.getElementById(tableId);
        if (!table) { return; }

        var searchInput = document.querySelector('[data-table-search="' + tableId + '"]');
        var term = searchInput ? searchInput.value.trim().toLowerCase() : '';

        var activeTab = document.querySelector('[data-filter-group="' + tableId + '"].active');
        var filter = activeTab ? activeTab.getAttribute('data-filter') : 'all';

        var visible = 0;
        table.querySelectorAll('tr[data-search-text]').forEach(function (row) {
            var haystack = (row.getAttribute('data-search-text') || '').toLowerCase();
            var rowFilter = row.getAttribute('data-filter') || '';
            var matchesTerm = term === '' || haystack.indexOf(term) !== -1;
            var matchesFilter = filter === 'all' || rowFilter.split(' ').indexOf(filter) !== -1;

            var show = matchesTerm && matchesFilter;
            row.style.display = show ? '' : 'none';
            if (show) { visible++; }
        });

        // "Nothing found" placeholder row
        var emptyRow = table.querySelector('.no-match-row');
        if (emptyRow) {
            emptyRow.style.display = visible === 0 ? '' : 'none';
        }
    }

    document.querySelectorAll('[data-table-search]').forEach(function (input) {
        var tableId = input.getAttribute('data-table-search');
        input.addEventListener('input', function () { filterTable(tableId); });
        input.addEventListener('search', function () { filterTable(tableId); });
    });

    document.querySelectorAll('[data-filter-group]').forEach(function (tab) {
        tab.addEventListener('click', function () {
            var tableId = tab.getAttribute('data-filter-group');
            document.querySelectorAll('[data-filter-group="' + tableId + '"]').forEach(function (other) {
                other.classList.remove('active');
            });
            tab.classList.add('active');
            filterTable(tableId);
        });
    });

    // ---------- "View All" toggle (dashboard completion rates) ----------
    document.querySelectorAll('[data-toggle-more]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var scope = document.getElementById(btn.getAttribute('data-toggle-more'));
            if (!scope) { return; }
            var hidden = scope.querySelectorAll('.meter-row.is-hidden, .meter-row.is-shown');
            var expanding = btn.getAttribute('data-expanded') !== '1';

            hidden.forEach(function (row) {
                row.classList.toggle('is-hidden', !expanding);
                row.classList.toggle('is-shown', expanding);
            });

            btn.setAttribute('data-expanded', expanding ? '1' : '0');
            btn.textContent = expanding ? 'Show top 3 only' : btn.getAttribute('data-label-more');
        });
    });

    // ---------- Show / hide password ----------
    document.querySelectorAll('.password-toggle').forEach(function (toggle) {
        toggle.addEventListener('click', function () {
            var field = document.getElementById(toggle.getAttribute('data-target'));
            if (!field) { return; }
            var showing = field.type === 'text';
            field.type = showing ? 'password' : 'text';
            toggle.classList.toggle('is-visible', !showing);
            toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        });
    });

    // ---------- Question builder: choice rows ----------
    // Delegated, so it also covers question rows added after page load.
    // One handler only: a second listener here is what made "Add Choice"
    // appear to add two boxes per click.
    function choiceRow(name, index) {
        var row = document.createElement('div');
        row.className = 'choice-row';

        var input = document.createElement('input');
        input.type = 'text';
        input.name = name + '[]';
        input.maxLength = 150;
        input.placeholder = 'Choice ' + index;

        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn-action btn-action-danger remove-choice-btn';
        remove.title = 'Remove this choice';
        remove.setAttribute('aria-label', 'Remove this choice');
        remove.innerHTML = '&times;';

        row.appendChild(input);
        row.appendChild(remove);
        return row;
    }

    document.addEventListener('click', function (e) {
        var addBtn = e.target.closest('.add-choice-btn');
        if (addBtn) {
            var box = addBtn.closest('.choices-box').querySelector('.choices-inputs');
            var name = box.getAttribute('data-choice-name') || 'choices';
            box.appendChild(choiceRow(name, box.querySelectorAll('input').length + 1));
            return;
        }

        var removeBtn = e.target.closest('.remove-choice-btn');
        if (removeBtn) {
            var row = removeBtn.closest('.choice-row');
            var inputs = row.parentNode.querySelectorAll('input');
            // Keep two boxes on screen: a multiple-choice question needs them.
            if (inputs.length <= 2) {
                row.querySelector('input').value = '';
            } else {
                row.remove();
            }
        }
    });

    // Show the choices box only for multiple choice, wherever it appears.
    document.addEventListener('change', function (e) {
        var select = e.target.closest('.question-type-select');
        if (!select) { return; }
        var box = select.closest('.question-row, form').querySelector('.choices-box');
        if (box) { box.style.display = select.value === 'multiple_choice' ? 'block' : 'none'; }
    });

    // ---------- Unsaved-changes warning ----------
    // Any form marked data-dirty-warn asks before the tab is closed or the
    // page navigated away from, unless the change is being submitted.
    document.querySelectorAll('form[data-dirty-warn]').forEach(function (form) {
        var dirty = false;
        form.addEventListener('input', function () { dirty = true; });
        form.addEventListener('change', function () { dirty = true; });
        form.addEventListener('submit', function () { dirty = false; });
        window.addEventListener('beforeunload', function (e) {
            if (!dirty) { return; }
            e.preventDefault();
            e.returnValue = '';
        });
        // Cancel inside a modal: confirm, then clear so reopening starts fresh.
        form.querySelectorAll('[data-modal-close]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                if (dirty && !window.confirm('Discard the details you entered?')) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                }
                form.reset();
                dirty = false;
            }, true);
        });
    });

    /* The "Find a Survey" filter that used to sit above the survey dropdowns
       was removed. It rebuilt the <select> from scratch on every keystroke,
       which threw away the current selection and fought the onchange that
       submits the form — so choosing a survey after typing did nothing. The
       survey lists are short enough to pick from directly, and Surveys still
       has a real search over its table. */

    // ---------- Filter open-text answers on the Results page ----------
    document.querySelectorAll('[data-answer-search]').forEach(function (input) {
        var scope = document.getElementById(input.getAttribute('data-answer-search'));
        if (!scope) { return; }
        input.addEventListener('input', function () {
            var needle = input.value.toLowerCase();
            var shown = 0;
            scope.querySelectorAll('[data-answer-text]').forEach(function (card) {
                var match = card.getAttribute('data-answer-text').toLowerCase().indexOf(needle) !== -1;
                card.style.display = match ? '' : 'none';
                if (match) { shown++; }
            });
            var empty = scope.parentNode.querySelector('.answer-no-match');
            if (empty) { empty.style.display = shown === 0 ? 'block' : 'none'; }
        });
    });

    console.log('script.js v7 loaded');
});
/* ============================================================================
   Family detail sections: Yes/No reveals and repeatable name rows
   ========================================================================= */
document.addEventListener('DOMContentLoaded', function () {

    /* ---------- Yes/No reveals ----------
       A radio declares data-reveals="<block id>". Value "1" shows the block,
       anything else hides it.

       The inputs inside a hidden block are disabled as well as hidden. That
       matters for two reasons: the browser refuses to submit a form with a
       hidden field it considers required, showing a validation message
       nobody can see; and a disabled field posts nothing, so answering No
       genuinely sends no spouse name rather than sending a stale one. */
    function syncReveal(name) {
        var radios = document.querySelectorAll('input[type="radio"][name="' + name + '"][data-reveals]');
        radios.forEach(function (radio) {
            var block = document.getElementById(radio.getAttribute('data-reveals'));
            if (!block || !radio.checked) { return; }

            var show = radio.value === '1';
            block.hidden = !show;
            block.querySelectorAll('input, select, textarea').forEach(function (field) {
                field.disabled = !show;
            });
        });
    }

    document.querySelectorAll('input[type="radio"][data-reveals]').forEach(function (radio) {
        radio.addEventListener('change', function () { syncReveal(radio.name); });
    });

    ['is_married', 'has_children'].forEach(syncReveal);

    /* ---------- Repeatable name rows ----------
       Each group is a container with data-person-rows="<field name>" holding
       one or more [data-person-row] blocks. "Add another" clones the first
       row rather than building HTML in a string, so the markup only has to be
       correct in one place — the PHP that rendered it. */
    function renumberRows(group) {
        var field = group.getAttribute('data-person-rows');
        var noun = group.getAttribute('data-row-noun') || 'Entry';
        var rows = group.querySelectorAll('[data-person-row]');

        rows.forEach(function (row, index) {
            var label = row.querySelector('[data-row-number]');
            if (label) { label.textContent = index + 1; }

            var title = row.querySelector('.person-row-title');
            if (title && !title.querySelector('[data-row-number]')) {
                title.textContent = noun + ' ' + (index + 1);
            }

            // Rewrite the index in children[0][last_name] so the rows stay a
            // proper list after one in the middle is removed.
            // Selects too: courtesy title and gender are dropdowns, and a row
            // whose selects keep the old index would post under the wrong
            // person after one in the middle is removed.
            row.querySelectorAll('input[name], select[name]').forEach(function (control) {
                control.name = control.name.replace(
                    new RegExp('^' + field + '\\[\\d+\\]'),
                    field + '[' + index + ']'
                );
            });

            // The only row left cannot be removed out from under the person.
            var remove = row.querySelector('[data-remove-row]');
            if (remove) { remove.style.display = rows.length > 1 ? '' : 'none'; }
        });
    }

    document.querySelectorAll('[data-person-rows]').forEach(function (group) {
        renumberRows(group);
    });

    /* The Edit Resident modal rebuilds these rows from the stored record when
       a resident is chosen, and needs the same numbering and name-rewriting
       applied afterwards. Sharing the function keeps one definition of what a
       correctly numbered set of rows looks like. */
    window.renumberPersonRows = renumberRows;

    document.querySelectorAll('[data-add-row]').forEach(function (button) {
        button.addEventListener('click', function () {
            var field = button.getAttribute('data-add-row');

            /* Scoped to the form the button sits in, not the whole page.
               Registered Residents renders the Add and Edit forms together,
               and the resident's own profile renders a request form beside
               the record, so a page holds more than one group of the same
               name. A global lookup always found the first, which meant
               pressing "Add another" in one form silently added the row to
               a different one. */
            var scope = button.closest('form')
                     || button.closest('.modal-box')
                     || document;
            var group = scope.querySelector('[data-person-rows="' + field + '"]')
                     || document.querySelector('[data-person-rows="' + field + '"]');
            if (!group) { return; }

            var rows = group.querySelectorAll('[data-person-row]');
            if (!rows.length) { return; }

            var copy = rows[0].cloneNode(true);
            copy.querySelectorAll('input, select').forEach(function (control) {
                control.value = '';
                control.disabled = false;
            });

            group.appendChild(copy);
            renumberRows(group);

            var firstField = copy.querySelector('input');
            if (firstField) { firstField.focus(); }
        });
    });

    // Delegated, because rows added after load need it too.
    document.addEventListener('click', function (event) {
        var remove = event.target.closest ? event.target.closest('[data-remove-row]') : null;
        if (!remove) { return; }

        var row = remove.closest('[data-person-row]');
        var group = remove.closest('[data-person-rows]');
        if (!row || !group) { return; }

        if (group.querySelectorAll('[data-person-row]').length <= 1) { return; }

        row.remove();
        renumberRows(group);
    });
});

/* ============================================================================
   "Others" on a family member's Courtesy Title
   ========================================================================= */
document.addEventListener('DOMContentLoaded', function () {
    /* The box to type into sits directly after the select, so it is found by
       walking forward rather than by id — the repeatable rows have no ids at
       all, and a cloned row would duplicate any that existed.

       Delegated from the document, because rows are added after load. */
    function otherBoxFor(select) {
        var node = select.nextElementSibling;
        while (node) {
            if (node.hasAttribute && node.hasAttribute('data-title-other')) { return node; }
            node = node.nextElementSibling;
        }
        return null;
    }

    function syncTitleSelect(select) {
        var box = otherBoxFor(select);
        if (!box) { return; }

        var wantsOther = select.value === 'Others';
        box.hidden = !wantsOther;

        // A hidden box must not carry a value through to the server: leaving
        // one behind would override the title actually chosen from the list.
        if (!wantsOther) { box.value = ''; }
    }

    document.addEventListener('change', function (event) {
        var select = event.target;
        if (select && select.hasAttribute && select.hasAttribute('data-title-select')) {
            syncTitleSelect(select);
        }
    });

    document.querySelectorAll('[data-title-select]').forEach(syncTitleSelect);
});
