window.onerror = function(message, source, lineno, colno, error) {
    console.error('GLOBAL ERROR:', message, 'at', source, lineno, colno, error);
};
window.onunhandledrejection = function(event) {
    console.error('UNHANDLED REJECTION:', event.reason);
};