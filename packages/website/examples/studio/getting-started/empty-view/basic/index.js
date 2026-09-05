import * as xeokit from "../../../../../js/xeokit-studio-bundle.js";

const studio = new xeokit.studio.Studio({});

studio.init({logging: false}).then(() => {
  studio.viewManager.createView({
    id: "emptyStudioView",
    camera: {
      eye: [8, -8, 6],
      look: [0, 0, 0],
      up: [0, 0, 1],
    },
    effects: {
      sky: {enabled: true},
      sao: {enabled: false},
      shadows: {enabled: false},
      edges: {enabled: false},
    },
  });

  studio.finished();
}).catch(err => {
  document.title = "Failed to create empty Studio view";
  console.error(err);
});
