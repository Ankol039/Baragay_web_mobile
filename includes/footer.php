</div><!-- /.container -->

<footer class="site-footer no-print">
    &copy; <?= date('Y') ?> Barangay Health Center &mdash; Survey Management System
</footer>
</div><!-- /.app-main -->

<!-- Shared confirmation modal used by every data-confirm link (delete, deactivate, reset, etc.) -->
<div class="modal-overlay no-print" id="confirm-modal" data-keep-on-close>
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close aria-label="Close">&times;</button>
        <div class="modal-icon-warning">!</div>
        <h2>Please Confirm</h2>
        <p id="confirm-modal-message" class="modal-text">Are you sure you want to proceed?</p>
        <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            <a href="#" id="confirm-modal-proceed" class="btn btn-danger">Yes, Continue</a>
        </div>
    </div>
</div>

<script src="<?= $asset_path ?? '' ?>assets/js/script.js?v=16"></script>
</body>
</html>
