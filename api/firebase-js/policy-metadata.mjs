// Snapshot of original pure form metadata; tested against unchanged PHP source.
export const metadata = {
    "profile": {
        "person": {
            "courtesy_title": {
                "label": "Courtesy Title",
                "type": "select",
                "required": false,
                "options": [
                    "Mr.",
                    "Mrs.",
                    "Ms.",
                    "Mx."
                ]
            },
            "first_name": {
                "label": "First Name",
                "type": "text",
                "required": true,
                "placeholder": "e.g. Juan",
                "maxlength": 50
            },
            "middle_name": {
                "label": "Middle Name",
                "type": "text",
                "required": false,
                "placeholder": "e.g. Santos",
                "maxlength": 50
            },
            "last_name": {
                "label": "Surname",
                "type": "text",
                "required": true,
                "placeholder": "e.g. Dela Cruz",
                "maxlength": 50
            },
            "name_extension": {
                "label": "Extension Name",
                "type": "text",
                "required": false,
                "placeholder": "e.g. Jr, Sr, III",
                "maxlength": 20
            },
            "gender": {
                "label": "Gender",
                "type": "select",
                "required": false,
                "options": {
                    "man": "Man",
                    "woman": "Woman",
                    "non_binary": "Non-binary",
                    "prefer_not_to_say": "Prefer not to say"
                }
            }
        },
        "address": {
            "household_number": {
                "label": "Household Number",
                "placeholder": "e.g. 1623 or Blk 13 Lot 3",
                "maxlength": 30,
                "required": true
            },
            "purok": {
                "label": "Purok",
                "placeholder": "e.g. Purok 3",
                "maxlength": 60,
                "required": false
            },
            "street_highway": {
                "label": "Street / Highway / Subdivision / Village",
                "placeholder": "e.g. Rizal Street",
                "maxlength": 120,
                "required": false
            },
            "barangay": {
                "label": "Barangay",
                "placeholder": "e.g. Anyatam",
                "maxlength": 80,
                "required": true
            },
            "municipality": {
                "label": "Municipality / City",
                "placeholder": "e.g. San Ildefonso",
                "maxlength": 80,
                "required": true
            },
            "postal_code": {
                "label": "Postal Code",
                "placeholder": "e.g. 3010",
                "maxlength": 4,
                "required": false
            },
            "province": {
                "label": "Province",
                "placeholder": "e.g. Bulacan",
                "maxlength": 80,
                "required": true
            }
        },
        "titles": [
            "Mr.",
            "Mrs.",
            "Ms.",
            "Mx."
        ],
        "contact_pattern": "[0-9+()\\-\\s]{7,20}",
        "hotline_pattern": "^((\\(02\\)|02)\\s?8\\d{3}[- ]?\\d{4}|8\\d{3}[- ]?\\d{4}|\\(0\\d{2,3}\\)\\s?\\d{3}[- ]?\\d{4}|09\\d{2}[- ]?\\d{3}[- ]?\\d{4})$",
        "hotline_hint": "Metro Manila: 8XXX-YYYY or (02) 8XXX-YYYY · Provincial: (0XX) XXX-YYYY, for example Pampanga (045) 123-4567."
    },
    "categories": {
        "pwd": {
            "label": "PWD ID Number",
            "placeholder": "03-1408-000-0000123",
            "format": "Format: RR-PPMM-BBB-NNNNNNN",
            "hint": "Region, province and municipality, barangay, then the serial. Example: 03-1408-000-0000123. Copy it from the PWD identification card.",
            "pattern": "\\d{2}-\\d{4}-\\d{3}-\\d{7}",
            "error": "A PWD ID Number looks like 03-1408-000-0000123 (RR-PPMM-BBB-NNNNNNN)."
        },
        "senior_citizen": {
            "label": "Senior Citizen ID Number",
            "placeholder": "SC-26-004512",
            "format": "Format: SC-00-000000",
            "hint": "From the OSCA-issued Senior Citizen card. Example: SC-26-004512.",
            "pattern": "SC-\\d{2}-\\d{6}",
            "error": "A Senior Citizen ID Number looks like SC-26-004512 (SC-00-000000)."
        },
        "pregnant": {
            "label": "Doctor's License Number",
            "placeholder": "PRC No. 123456",
            "format": "Format: PRC No. 000000",
            "hint": "On a prescription pad or medical certificate this is labelled \"PRC No.\", \"License No.\" or \"PRC License No.\" Example: PRC No. 123456.",
            "pattern": "(?:(?:PRC|License|PRC License)\\s*(?:No\\.?|Number)?\\s*)?\\d{6,7}",
            "error": "A doctor's licence number is six or seven digits, e.g. PRC No. 123456."
        }
    },
    "gender": {
        "man": "Man",
        "woman": "Woman",
        "non_binary": "Non-binary",
        "prefer_not_to_say": "Prefer not to say"
    },
    "residence": {
        "AR": "AR - Apartment Residence",
        "DR": "DR - Dormitory Residence",
        "BH": "BH - Boarding House",
        "BS": "BS - Bedspace",
        "RL": "RL - Relative's House",
        "TR": "TR - Transient Room"
    },
    "titles": [
        "Mr.",
        "Mrs.",
        "Ms.",
        "Mx."
    ],
    "addresses": [
        "household_number",
        "purok",
        "street_highway",
        "barangay",
        "municipality",
        "postal_code",
        "province"
    ],
    "addressLabels": {
        "household_number": "Household Number",
        "purok": "Purok",
        "street_highway": "Street / Highway / Subdivision / Village",
        "barangay": "Barangay",
        "municipality": "Municipality / City",
        "postal_code": "Postal Code",
        "province": "Province"
    },
    "requiredAddresses": [
        "household_number",
        "barangay",
        "municipality",
        "province"
    ],
    "password": {
        "length": "At least 8 characters long",
        "upper": "One uppercase letter (A-Z)",
        "lower": "One lowercase letter (a-z)",
        "number": "One number (0-9)",
        "space": "No spaces"
    }
}
