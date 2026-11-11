<?php
/**
 * Render one person's fields — courtesy title, the four name parts, gender.
 *
 * Used for the spouse, each parent, each child and each character reference,
 * so all five are collected identically and match the seven rows the
 * resident's own Profile Overview shows. $name_for turns a field key into the
 * form field name, which differs between a single person (spouse_last_name)
 * and a repeatable row (children[0][last_name]).
 */
if (!function_exists('render_person_fields')) {
    function render_person_fields($name_for, $values, $id_prefix = '') {
        foreach (person_field_spec() as $field => $spec) {
            $field_name = $name_for($field);
            $field_id = $id_prefix !== '' ? $id_prefix . '_' . $field : '';
            $current = (string)($values[$field] ?? '');
            ?>
            <div>
                <label <?= $field_id !== '' ? 'for="' . h($field_id) . '"' : '' ?>>
                    <?= h($spec['label']) ?><?= !empty($spec['required']) ? ' <span class="req">*</span>' : '' ?>
                </label>
                <?php if ($spec['type'] === 'select'): ?>
                <?php
                /*
                 * Courtesy Title carries an Others option and a box to type
                 * into, exactly as the resident's own title does. A spouse may
                 * be an Engr. and a character reference an Atty., and a fixed
                 * list of four would have forced whoever was filling the form
                 * to leave the title blank or put the wrong one.
                 *
                 * A stored title that is not one of the four — anything set
                 * through that box before — selects Others and reappears in
                 * the box, so reopening the form shows what was saved rather
                 * than silently dropping it back to blank.
                 */
                $allows_other = $field === 'courtesy_title';
                $option_values = [];
                foreach ($spec['options'] as $opt_key => $opt_label) {
                    $option_values[] = is_int($opt_key) ? $opt_label : $opt_key;
                }
                $is_custom = $allows_other && $current !== '' && !in_array($current, $option_values, true);
                ?>
                <select <?= $field_id !== '' ? 'id="' . h($field_id) . '"' : '' ?>
                        name="<?= h($field_name) ?>"
                        <?= $allows_other ? 'data-title-select' : '' ?>>
                    <option value="">Select</option>
                    <?php foreach ($spec['options'] as $opt_key => $opt_label):
                        // courtesy_titles() is a plain list; gender_options() is keyed.
                        $value = is_int($opt_key) ? $opt_label : $opt_key;
                    ?>
                    <option value="<?= h($value) ?>" <?= (!$is_custom && $current === (string)$value) ? 'selected' : '' ?>><?= h($opt_label) ?></option>
                    <?php endforeach; ?>
                    <?php if ($allows_other): ?>
                    <option value="Others" <?= $is_custom ? 'selected' : '' ?>>Others</option>
                    <?php endif; ?>
                </select>
                <?php if ($allows_other): ?>
                <input type="text"
                       <?= $field_id !== '' ? 'id="' . h($field_id) . '_other"' : '' ?>
                       name="<?= h($name_for('courtesy_title_other')) ?>"
                       maxlength="20"
                       data-title-other
                       placeholder="Dr., Engr., Atty."
                       value="<?= h($is_custom ? $current : '') ?>"
                       <?= $is_custom ? '' : 'hidden' ?>>
                <?php endif; ?>
                <?php else: ?>
                <input type="text"
                       <?= $field_id !== '' ? 'id="' . h($field_id) . '"' : '' ?>
                       name="<?= h($field_name) ?>"
                       maxlength="<?= (int)($spec['maxlength'] ?? 50) ?>"
                       placeholder="<?= h($spec['placeholder'] ?? '') ?>"
                       value="<?= h($current) ?>">
                <?php endif; ?>
            </div>
            <?php
        }
    }
}
?>
<?php
/**
 * Family and household detail fields.
 *
 * Included by both the Add Resident and Edit Resident forms so the two cannot
 * drift apart. Everything is driven by two variables set before the include:
 *
 *   $ff_prefix  - 'add' or 'edit'. Keeps element ids unique when both forms
 *                 exist on the same page, which they do here.
 *   $ff_values  - the current values, laid out the same way whether they came
 *                 from a rejected submission or from the database.
 *
 * The repeatable sections (children, character references) are built from a
 * <template>, so the "Add another" button clones real markup rather than
 * pasting a string of HTML together in JavaScript.
 */

$ff_prefix = $ff_prefix ?? 'add';
$ff_values = $ff_values ?? [];

$ff_id = function ($name) use ($ff_prefix) {
    return $ff_prefix . '_' . $name;
};

$ff_val = function ($name, $default = '') use ($ff_values) {
    return (string)($ff_values[$name] ?? $default);
};

// Rows always render at least one blank set, otherwise a resident with no
// children yet would see a section with nothing to type into.
$ff_children   = !empty($ff_values['children'])   ? $ff_values['children']   : [];
$ff_references = !empty($ff_values['references']) ? $ff_values['references'] : [];

$ff_is_married   = (string)$ff_val('is_married', '0') === '1';
$ff_has_children = (string)$ff_val('has_children', '0') === '1';
?>

<h3 class="form-section-title">Work and Household Contact</h3>

<div class="grid-2">
    <div>
        <label for="<?= h($ff_id('occupation')) ?>">Occupation</label>
        <input type="text" id="<?= h($ff_id('occupation')) ?>" name="occupation" maxlength="100"
               placeholder="e.g. Student, Tricycle driver, Teacher, N/A"
               value="<?= h($ff_val('occupation')) ?>">
        <small class="field-hint">Type it in full. Put "N/A" if they are not working or studying.</small>
    </div>
    <div>
        <label for="<?= h($ff_id('hotline_number')) ?>">Hotline Number</label>
        <input type="text" id="<?= h($ff_id('hotline_number')) ?>" name="hotline_number" maxlength="30"
               pattern="<?= h(hotline_number_pattern()) ?>"
               title="<?= h(hotline_format_hint()) ?>"
               placeholder="(02) 8123-4567"
               value="<?= h($ff_val('hotline_number')) ?>">
        <small class="field-hint">Optional. <?= h(hotline_format_hint()) ?></small>
    </div>
</div>

<h3 class="form-section-title">Spouse</h3>

<div class="choice-row" role="group" aria-label="Is this resident married?">
    <span class="choice-question">Is this resident married?</span>
    <label class="choice-option">
        <input type="radio" name="is_married" value="1" data-reveals="<?= h($ff_id('spouse-block')) ?>"
               <?= $ff_is_married ? 'checked' : '' ?>>
        <span>Yes</span>
    </label>
    <label class="choice-option">
        <input type="radio" name="is_married" value="0" data-reveals="<?= h($ff_id('spouse-block')) ?>"
               <?= $ff_is_married ? '' : 'checked' ?>>
        <span>No</span>
    </label>
</div>

<?php // Hidden until Yes is chosen. The inputs inside are disabled while
      // hidden so nothing is posted for an unmarried resident. ?>
<div class="reveal-block" id="<?= h($ff_id('spouse-block')) ?>" <?= $ff_is_married ? '' : 'hidden' ?>>
    <div class="grid-2">
        <?php
        $spouse_values = [];
        foreach (person_field_keys() as $ff_k) { $spouse_values[$ff_k] = $ff_val('spouse_' . $ff_k); }
        render_person_fields(
            function ($f) { return 'spouse_' . $f; },
            $spouse_values,
            $ff_id('spouse')
        );
        ?>
    </div>
</div>

<h3 class="form-section-title">Children</h3>

<div class="choice-row" role="group" aria-label="Does this resident have children?">
    <span class="choice-question">Does this resident have children?</span>
    <label class="choice-option">
        <input type="radio" name="has_children" value="1" data-reveals="<?= h($ff_id('children-block')) ?>"
               <?= $ff_has_children ? 'checked' : '' ?>>
        <span>Yes</span>
    </label>
    <label class="choice-option">
        <input type="radio" name="has_children" value="0" data-reveals="<?= h($ff_id('children-block')) ?>"
               <?= $ff_has_children ? '' : 'checked' ?>>
        <span>No</span>
    </label>
</div>

<div class="reveal-block" id="<?= h($ff_id('children-block')) ?>" <?= $ff_has_children ? '' : 'hidden' ?>>
    <div class="person-rows" data-person-rows="children" data-row-noun="Child">
        <?php
        $ff_child_rows = $ff_children ?: [array_fill_keys(person_field_keys(), '')];
        foreach ($ff_child_rows as $index => $child):
        ?>
        <div class="person-row" data-person-row>
            <div class="person-row-head">
                <span class="person-row-title">Child <span data-row-number><?= (int)$index + 1 ?></span></span>
                <button type="button" class="btn-link-danger" data-remove-row>Remove</button>
            </div>
            <div class="grid-2">
                <?php render_person_fields(
                    function ($f) use ($index) { return 'children[' . (int)$index . '][' . $f . ']'; },
                    $child
                ); ?>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
    <button type="button" class="btn btn-secondary btn-small" data-add-row="children">+ Add another child</button>
</div>

<h3 class="form-section-title">Parents</h3>
<p class="form-section-note">Optional. Fill in what is known.</p>

<div class="grid-2">
    <?php foreach (['father' => "Father", 'mother' => "Mother"] as $parent => $parent_label): ?>
    <div class="parent-column">
        <h4 class="form-subsection-title"><?= h($parent_label) ?>'s Name</h4>
        <?php
        $parent_values = [];
        foreach (person_field_keys() as $ff_k) { $parent_values[$ff_k] = $ff_val($parent . '_' . $ff_k); }
        render_person_fields(
            function ($f) use ($parent) { return $parent . '_' . $f; },
            $parent_values,
            $ff_id($parent)
        );
        ?>
    </div>
    <?php endforeach; ?>
</div>

<h3 class="form-section-title">Character References <span class="req">*</span></h3>
<p class="form-section-note">
    At least one is required, whether the resident is temporary or permanent.
    Add more if there are others who can vouch for them.
</p>

<div class="person-rows" data-person-rows="references" data-row-noun="Character reference">
    <?php
    $ff_reference_rows = $ff_references ?: [array_fill_keys(person_field_keys(), '')];
    foreach ($ff_reference_rows as $index => $reference):
    ?>
    <div class="person-row" data-person-row>
        <div class="person-row-head">
            <span class="person-row-title">Character reference <span data-row-number><?= (int)$index + 1 ?></span></span>
            <button type="button" class="btn-link-danger" data-remove-row>Remove</button>
        </div>
        <div class="grid-2">
            <?php render_person_fields(
                function ($f) use ($index) { return 'references[' . (int)$index . '][' . $f . ']'; },
                $reference
            ); ?>
        </div>
    </div>
    <?php endforeach; ?>
</div>
<button type="button" class="btn btn-secondary btn-small" data-add-row="references">+ Add another reference</button>
