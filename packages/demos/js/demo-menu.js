const list = document.getElementById('index');
const viewer = document.getElementById('viewer');
const viewerOverlay = document.getElementById('viewer-overlay');

const container = document.createElement('div');
list.appendChild(container);

const viewSourceButton = document.getElementById('viewSourceButton');
viewSourceButton.addEventListener('click', function (event) {
    window.open('https://github.com/xeokit/xeokit-sdk/blob/master/examples/scenegraph/' + selected + '.html');
}, false);

const indexToggle = document.getElementById("index_toggle");
const pageTitle = document.getElementById('page-title');

viewerOverlay.addEventListener('click', function (event) {
    indexToggle.checked = false;
}, false);

// indexToggle.addEventListener('click', function (event) {
//     viewer.src="default.html";
// }, false);

const sectionDivs = {};
const divs = {};
const fileDescriptions = {};
let selected = null;
let index = 1;
var indexStr;

// Index

let div = document.createElement('h2');
div.textContent = "Index";

container.appendChild(div);
container.appendChild(document.createElement('hr'));

const sectionNames = Object.keys(files);
// sectionNames.sort((a, b) => {
//     if (a < b) {
//         return -1;
//     }
//     if (a > b) {
//         return 1;
//     }
//     return 0;
// });

for (let i = 0, len = sectionNames.length; i < len; i++) {
    const sectionName = sectionNames[i];
    const sectionFiles = files[sectionName];
    var sectionDiv = document.createElement('div');
    sectionDiv.className = 'link';
    indexStr = "" + index++ + ".";
    for (let i = indexStr.length, len = 5; i < len; i++) {
        indexStr += ".";
    }
    sectionDiv.textContent = indexStr + sectionName;
    sectionDiv.addEventListener('click', (function () {
        const _sectionName = sectionName;
        return function () {
            sectionDivs[_sectionName].scrollIntoView();
        }
    })());
    container.appendChild(sectionDiv);
}

container.appendChild(document.createElement('hr'));

_index = 1;

let clickedFile = null;

for (let i = 0, len = sectionNames.length; i < len; i++) {
    const sectionName = sectionNames[i];
    const sectionFiles = files[sectionName];
    const sectionDiv = document.createElement('h2');
    sectionDiv.textContent = _index++ + ". " + sectionName;
    container.appendChild(sectionDiv);
    sectionDivs[sectionName] = sectionDiv;
    container.appendChild(document.createElement('hr'));

    for (let i = 0; i < sectionFiles.length; i++) {

        let sectionFile = sectionFiles[i];
        let fileName;
        let fileDesc;

        if (!isString(sectionFile)) {
            fileName = sectionFile[0];
            fileDesc = sectionFile[1];
        } else {
            fileName = sectionFile;
            fileDesc = sectionFile;
        }

        if (fileDesc.charAt(0) === "#") {
            const commentDiv = document.createElement('div');
            commentDiv.textContent = "// " + fileDesc.substring(1);
            commentDiv.className = (i === 0 ? 'commentFirst' : 'comment');
            container.appendChild(commentDiv);
            continue;
        }

        const fileNameComponents = fileName.split('_');
        const fileNamePath = fileNameComponents.join(' / ');
        const fileNameDiv = document.createElement('div');
        fileNameDiv.className = 'link';
        fileNameDiv.textContent = fileNamePath; // expandCamel(name);
     //   fileNameDiv.textContent = fileNamePath.substring(fileNamePath.indexOf('/')+1); // expandCamel(name);
        fileNameDiv.addEventListener('click', (function () {
            const _file = fileName;
            return function () {
                clickedFile = _file;
                window.location.hash = "#" + _file;
                viewer.src = "";
            }
        })());
        container.appendChild(fileNameDiv);
        divs[fileName] = fileNameDiv;
        fileDescriptions[fileName] = fileDesc;
    }
}

const paddingDiv = document.createElement('div');
paddingDiv.style["height"] = "50px";
container.appendChild(paddingDiv);

function expandCamel(str) {
    return str.replace(/([A-Z])/g, function ($1) {
        return " " + $1.toLowerCase();
    });
}

if (window.location.hash !== '') {
    load(window.location.hash.substring(1));
} else {
    indexToggle.checked = true;
}

var hash = window.location.hash;

window.setInterval(function () {
    if (window.location.hash !== hash || viewer.src === "") {
        setTimeout(() => {
            load(window.location.hash.substring(1));
            hash = window.location.hash;
        }, 300)

        indexToggle.checked = false;
    }
}, 70);

function scrollIntoView(div) {
    document.getElementById("index").scrollTop = documentOffsetTop(div) - (window.innerHeight / 6);
}

function documentOffsetTop(div) {
    return div.offsetTop + (div.offsetParent ? documentOffsetTop(div.offsetParent) : 0);
}

function load(file) {

    pageTitle.innerText = fileDescriptions[file] || "Example not found - perhaps renamed?";

    if (file.indexOf(".html", file.length - 5) !== -1) {
        window.location = "./" + file + ".html";
        return;
    }

    if (selected !== null) divs[selected].className = 'link';
    divs[file].className = 'link selected';
    window.location.hash = file;
    viewer.src = file;
   // viewer.src = file + '.html';
    viewer.focus();
    viewSourceButton.style.display = '';
    selected = file;
    if (clickedFile !== file) {
        scrollIntoView(divs[file]);
    }
    clickedFile = null;
}

function isString(value) {
    return (typeof value === 'string' || value instanceof String);
}
