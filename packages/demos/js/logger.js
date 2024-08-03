const div = document.createElement(`div`);
div.style.color = "white";
div.style.background = "black";
div.style.opacity = "1";
div.style.padding = "10px";
div.style.position = "absolute";
div.style.fontSize = "18px";
div.style.left = "75px";
div.style.top = "80px";
div.style.pointerEvents = "all";
div.style.lineHeight = "22pt";
div.style["z-index"] = 1000000;
document.body.appendChild(div);

export function log(msg) {
    div.innerText += msg + "\n";
}
