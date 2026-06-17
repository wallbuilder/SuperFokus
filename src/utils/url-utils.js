const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$/;
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^((([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){6}:[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){5}:([0-9A-Fa-f]{1,4}:)?)[0-9A-Fa-f]{1,4}|(([0-9A-Fa-f]{1,4}:){4}:([0-9A-Fa-f]{1,4}:){0,2})[0-9A-Fa-f]{1,4}|(([0-9A-Fa-f]{1,4}:){3}:([0-9A-Fa-f]{1,4}:){0,3})[0-9A-Fa-f]{1,4}|(([0-9A-Fa-f]{1,4}:){2}:([0-9A-Fa-f]{1,4}:){0,4})[0-9A-Fa-f]{1,4}|(([0-9A-Fa-f]{1,4}:){1}:([0-9A-Fa-f]{1,4}:){0,5})[0-9A-Fa-f]{1,4}|(::([0-9A-Fa-f]{1,4}:){0,6}[0-9A-Fa-f]{1,4})|(::[0-9A-Fa-f]{1,4})|([0-9A-Fa-f]{1,4}::)|(::))(\/([0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8]))?$/;

/**
 * Normalizes a host string by cleaning it and extracting the hostname.
 * @param {string} value - The raw host or URL string.
 * @returns {string|null} - The normalized hostname or null if invalid.
 */
function normalizeHost(value) {
    if (!value || typeof value !== 'string') return null;
    const cleaned = value.trim();
    if (!cleaned) return null;

    let hostname = null;
    try {
        let url = cleaned;
        if (!/^https?:\/\//i.test(url)) {
            url = `http://${url}`;
        }
        hostname = new URL(url).hostname.toLowerCase();
    } catch (e) {
        // Fallback for strings that are not valid URLs but might be hostnames
        hostname = cleaned.replace(/^https?:\/\//i, '').split(/[\/?#]/)[0].toLowerCase();
    }

    if (!hostname) return null;
    
    // Remove port if present
    hostname = hostname.split(':')[0];

    // Basic cleaning
    if (hostname === 'localhost') return null;
    if (hostname.endsWith('.')) hostname = hostname.slice(0, -1);

    // Validate against regexes
    if (!DOMAIN_REGEX.test(hostname) && !IP_REGEX.test(hostname)) {
        return null;
    }

    return hostname;
}

module.exports = {
    normalizeHost,
    DOMAIN_REGEX,
    IP_REGEX
};
