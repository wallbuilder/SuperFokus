window.onerror = function(msg, url, lineNo, columnNo, error) {
    document.body.innerHTML = `<div style="color:red; background:white; padding:20px; border:2px solid red;">
        <h3>JS Error Caught</h3>
        <p>${msg}</p>
        <p>Line: ${lineNo}:${columnNo}</p>
    </div>`;
    return false;
};