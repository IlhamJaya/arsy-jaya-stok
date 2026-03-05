// Function to capitalize first letter of each sentence or the start of the text
export const capitalizeFirstLetter = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

export const capitalizeWords = (str) => {
    if (!str) return '';
    return str.replace(/\b[a-z\u00C0-\u00FF]/g, char => char.toUpperCase());
};

// Validates and returns numbers only.
export const handleNumberInput = (e, showToast) => {
    const value = e.target.value;
    if (value === '') return value;

    // Check if there's any non-numeric character
    if (/[^\d]/.test(value)) {
        if (showToast) {
            showToast("Hanya angka yang diperbolehkan", true);
        }
    }
    return value.replace(/[^\d]/g, '');
};
