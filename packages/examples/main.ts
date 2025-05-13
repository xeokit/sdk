import examples from './html-map.json';

// for each example att html element in div with id "examples"
const examplesDiv = document.getElementById("examples");
if (examplesDiv) {
  Object.keys(examples).forEach(example => {
    const exampleDiv = document.createElement("div");
    exampleDiv.className = "example";
    exampleDiv.innerHTML = `<a href="./src/${examples[example]}">${example}</a>`;
    console.log(exampleDiv);
    examplesDiv.appendChild(exampleDiv);
  });
}
