window.onerror = function(msg, url, lineNo, columnNo, error) {
    document.body.textContent = '';
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'color:red; background:white; padding:20px; border:2px solid red;';

    const heading = document.createElement('h3');
    heading.textContent = 'JS Error Caught';

    const msgEl = document.createElement('p');
    msgEl.textContent = String(msg);

    const lineEl = document.createElement('p');
    lineEl.textContent = `Line: ${lineNo}:${columnNo}`;

    wrapper.appendChild(heading);
    wrapper.appendChild(msgEl);
    wrapper.appendChild(lineEl);
    document.body.appendChild(wrapper);
    return false;
};