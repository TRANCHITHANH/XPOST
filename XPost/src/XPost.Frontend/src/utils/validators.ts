/**
 * Validates if the input is a proper email address.
 */
export const isValidEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

/**
 * Validates if the password meets minimum security standards:
 * At least 8 chars, 1 uppercase, 1 lowercase, 1 number.
 */
export const isStrongPassword = (password: string): boolean => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\W]{8,}$/;
    return regex.test(password);
};

/**
 * Example generic required field validator.
 */
export const isRequired = (value: string | undefined | null): boolean => {
    return value !== undefined && value !== null && value.trim().length > 0;
};
