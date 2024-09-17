export function buildViewModelsMenu(params) {

    const {datasets, pipelines} = params;

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

    const pipelineLookup = {};

    for (let i = 0, len = pipelines.pipelines.length; i < len; i++) {
        const pipeline = pipelines.pipelines[i];
        pipeline.models = [];
        pipelineLookup[pipeline.id] = pipeline;
    }

    for (let i = 0, len = datasets.models.length; i < len; i++) {
        const model = datasets.models[i];
        const pipelineIds = model.pipelines;
        for (let j = 0, lenj = pipelineIds.length; j < lenj; j++) {
            const pipelineId = pipelineIds[j];
            const pipeline = pipelineLookup[pipelineId];
            pipeline.models.push(model)
        }
    }

    for (let i = 0, len = pipelines.pipelines.length; i < len; i++) {
        const pipeline = pipelines.pipelines[i];
        if (pipeline.models.length === 0) {
            continue;
        }
        const pipelineId = pipeline.id;
        const pipelineName = pipeline.name || pipeline.id;
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'link';
        indexStr = "" + index++ + ".";
        for (let i = indexStr.length, len = 5; i < len; i++) {
            indexStr += ".";
        }
        sectionDiv.textContent = indexStr + pipelineName;
        sectionDiv.addEventListener('click', (function () {
            const _sectionId = pipelineId;
            return function () {
                sectionDivs[_sectionId].scrollIntoView();
            }
        })());
        container.appendChild(sectionDiv);
    }


    container.appendChild(document.createElement('hr'));

    let _index = 1;

    let clickedFile = null;

    for (let i = 0, len = pipelines.pipelines.length; i < len; i++) {

        const pipeline = pipelines.pipelines[i];
        if (pipeline.models.length === 0) {
            continue;
        }
        const pipelineId = pipeline.id;
        const pipelineName = pipeline.name || pipeline.id;
        const pipelineModels = pipeline.models;

        const sectionDiv = document.createElement('h2');
        sectionDiv.textContent = _index++ + ". " + pipelineName;
        container.appendChild(sectionDiv);

        const caseDiv = document.createElement('div');
        caseDiv.style.color = "grey";
        caseDiv.style.fontStyle = "italic";
        caseDiv.className = 'code';
        caseDiv.innerHTML = pipeline.case;
        container.appendChild(caseDiv);


        // const descDiv = document.createElement('div');
        // descDiv.style.color = "grey";
        // descDiv.style.fontStyle = "italic";
        // descDiv.className = 'code';
        // descDiv.textContent = pipeline.desc;
        // container.appendChild(descDiv);

        sectionDivs[pipelineId] = sectionDiv;
        container.appendChild(document.createElement('hr'));


        for (let i = 0; i < pipelineModels.length; i++) {
            const model = pipelineModels[i];
            const modelId = model.id;
            const viewerPage = `viewModel.html?modelId=${modelId}&pipelineId=${pipelineId}`;
            const fileNameDiv = document.createElement('div');
            fileNameDiv.className = 'link';
            fileNameDiv.textContent = modelId;
            fileNameDiv.addEventListener('click', (function () {
                const _file = viewerPage;
                return function () {
                    clickedFile = _file;
                    window.location.hash = "#" + _file;
                    viewer.src = "";
                }
            })());
            container.appendChild(fileNameDiv);
            divs[viewerPage] = fileNameDiv;
            fileDescriptions[viewerPage] = `${pipeline.case}`;
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

        pageTitle.innerHTML = fileDescriptions[file] || "Example not found - perhaps renamed?";

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
}
