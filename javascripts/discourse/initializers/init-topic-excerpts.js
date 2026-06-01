import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.8", (api) => {
  api.modifyClass("component:topic-list-item", {
    pluginId: "May_2026_update",
    expandPinned: true,
  });
});
