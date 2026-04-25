const DOMAIN_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

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
        hostname = cleaned.replace(/^https?:\/\//i, '').split(/[\/?#]/)[0].toLowerCase();
    }

    if (!hostname) return null;
    hostname = hostname.split(':')[0];

    if (hostname === 'localhost') return null;
    if (hostname.endsWith('.')) hostname = hostname.slice(0, -1);

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
