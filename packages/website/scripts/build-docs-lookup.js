//
// Creates a lookup table of info for all API types (class, functions, constants etc.) in ./data/docsLookup.json
//

const fs = require('fs');
const path = require('path');

function buildDocsLookup(docsDir) {

    console.log("buildDocsLookup")

    const jsonDir = `${docsDir}/json/`;

    const index = new Map();

    function getFirstSentence(text) {
        let match = text.match(/[^.!?]+[.!?]/);
        const sentence = match ? match[0].trim() : text.trim();
        return sentence;
    }

    function getSummary(node) {
        if (node.signatures) {
            node = node.signatures[0];
        }
        if (!node.comment || !node.comment.summary || node.comment.summary.length === 0) {
            return "";
        }
        const summary = [];
        const nodeSummary = node.comment.summary;
        for (let i = 0, len = nodeSummary.length; i < len; i++) {
            const text = nodeSummary[i].text;
            if (text) {
                summary.push(text);
            }
        }

        return getFirstSentence(summary.join("").split('.')[0]) + "."; // Extract part before first period
    }

    const parseChildren = (namespace, node) => {
        const children = node.children;
        if (children) {
            for (let child of children) {
                const kind = child.kind;
                const entry = {
                    summary: "",
                    path: null,
                    kind: null
                };
                //   console.log("child.name, kind = " + child.name + " , " + child.kind)
                switch (kind) {
                    case 4:
                        entry.path = `/api-docs#./docs/api/modules/${child.name}.html`;
                        entry.kind = "module";
                        namespace = child.name;
                        parseChildren(namespace, child);
                        break;
                    case 128:
                        entry.path = `/api-docs#./docs/api/classes/${namespace}.${child.name}.html`;
                        entry.kind = "class";
                        break;
                    case 32:
                        entry.path = `/api-docs#./docs/api/variables/${namespace}.${child.name}.html`;
                        entry.kind = "variable";
                        break;
                    case 64:
                        entry.path = `/api-docs#./docs/api/functions/${namespace}.${child.name}.html`;
                        entry.kind = "function";
                        break;
                    case 87:
                    case 256:
                        entry.path = `/api-docs#./docs/api/interfaces/${namespace}.${child.name}.html`;
                        entry.kind = "interface";
                        break;
                    case 2097152:
                        entry.path = `/api-docs#./docs/api/types/${namespace}.${child.name}.html`;
                        entry.kind = "type";
                        break;
                    default:
                        console.log(`kind not handled: ${kind}`)
                }
                entry.namespace = namespace;
                entry.summary = entry.kind === "module" ? "SDK Module" : getSummary(child);
                const entryKey = entry.kind === "module" ? `@xeokit/sdk/${child.name}` : child.name;
                index.set(entryKey, entry);
            }
        }
    }

    try {

        const files = fs.readdirSync(jsonDir);

        files.forEach(file => {
            const filePath = path.join(jsonDir, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
                try {
                    const data = fs.readFileSync(filePath, 'utf8');
                    const moduleData = JSON.parse(data);
                    const packageId = moduleData.name;
                    const offset = "@xeokit/".length;
                    const namespace = packageId.substring(offset);
                    parseChildren(namespace, moduleData);
                } catch (err) {
                    console.error(`Error reading or parsing JSON in file: ${filePath}`, err);
                }
            }
        });
    } catch (err) {
        console.error(`Error reading directory: ${err}`);
    }

    const sortedIndex = Object.fromEntries([...index.entries()].sort((a, b) => a[0].localeCompare(b[0])));
    return sortedIndex;
}

const docsDirectory = './docs';
const index = buildDocsLookup(docsDirectory);

fs.writeFileSync("./data/docsLookup.json", JSON.stringify(index, null, 2), 'utf8');
